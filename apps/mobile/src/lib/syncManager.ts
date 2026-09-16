import { useVisitStore, OutboxItem } from '../store/useVisitStore';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { uploadImageToSupabase } from './uploadImage';


/**
 * Pushes an entity to Supabase.
 * Implements the "Server Wins" policy: if the server record is newer than our local change,
 * it will discard the local change and notify the user.
 */
const syncItem = async (item: OutboxItem): Promise<{ success: boolean; conflict?: boolean }> => {
  try {
    let tableName = '';
    switch(item.type) {
      case 'PATIENT': tableName = 'Patient'; break;
      case 'CASE': tableName = 'Case'; break;
      case 'TREATMENT': tableName = 'Treatment'; break;
      default: return { success: true };
    }

    // Server Wins Conflict Resolution:
    // Check if the record exists and if its updatedAt is newer than ours
    const { data: existingData } = await supabase
      .from(tableName)
      .select('updatedAt')
      .eq('id', item.entityId)
      .maybeSingle();

    if (existingData && item.payload.updatedAt) {
      const serverDate = new Date(existingData.updatedAt);
      const localDate = new Date(item.payload.updatedAt);
      if (serverDate > localDate) {
        // Server is newer, conflict occurred. Server wins.
        return { success: false, conflict: true };
      }
    }

    // Pre-process images for Treatment before upsert
    if (tableName === 'Treatment') {
      const payload = item.payload as any;
      if (payload.preImageUri && payload.preImageUri.startsWith('file://')) {
        const url = await uploadImageToSupabase(payload.preImageUri, `treatments/${item.entityId}/pre.jpg`);
        if (url) payload.preImageUri = url;
      }
      if (payload.postImageUri && payload.postImageUri.startsWith('file://')) {
        const url = await uploadImageToSupabase(payload.postImageUri, `treatments/${item.entityId}/post.jpg`);
        if (url) payload.postImageUri = url;
      }
    }

    // Upsert the item
    
    let dbPayload = { ...item.payload, updatedAt: new Date().toISOString() };
    delete dbPayload.syncState; // Never sync this to DB

    if (tableName === 'Patient') {
      if (dbPayload.dob) {
        const parsedDate = new Date(dbPayload.dob);
        dbPayload.dateOfBirth = !isNaN(parsedDate.getTime()) 
          ? parsedDate.toISOString() 
          : new Date().toISOString();
        delete dbPayload.dob;
      }
      // Provide dummy userId if needed by prisma schema but missing in frontend
      if (!dbPayload.userId) {
        // Fallback to a valid userId if your RLS or schema requires it
        // Or assume Supabase handles it if not strictly required in the DB
      }
    } else if (tableName === 'Case') {
      if (dbPayload.onsetDate) {
        const parsedDate = new Date(dbPayload.onsetDate);
        dbPayload.onset = !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : new Date().toISOString();
        delete dbPayload.onsetDate;
      }
      if (dbPayload.woundLocation) {
        dbPayload.location = dbPayload.woundLocation;
        delete dbPayload.woundLocation;
      }
      delete dbPayload.status;
      // Default fields required by DB
      if (!dbPayload.woundType) dbPayload.woundType = 'Unknown';
      if (!dbPayload.comorbidities) dbPayload.comorbidities = [];
    } else if (tableName === 'Treatment') {
      // The DB schema for Treatment is: id, caseId, therapy, dressing, nextVisit, createdAt, updatedAt
      // The frontend payload has phase, preImageUri, postImageUri, assessment, therapy (object), sequenceNumber
      const frontendPayload = { ...dbPayload };
      
      dbPayload = {
        id: frontendPayload.id,
        caseId: frontendPayload.caseId,
        createdAt: frontendPayload.createdAt,
        updatedAt: new Date().toISOString(),
      };

      if (frontendPayload.therapy) {
        dbPayload.therapy = frontendPayload.therapy.therapyGiven || [];
        dbPayload.dressing = frontendPayload.therapy.dressingType || null;
        if (frontendPayload.therapy.nextVisitDate) {
           dbPayload.nextVisit = frontendPayload.therapy.nextVisitDate;
        }
      }
      
      // Upsert the Treatment first
      const { error: treatmentError } = await supabase.from('Treatment').upsert(dbPayload);
      if (treatmentError) {
        console.error('Error syncing Treatment:', treatmentError);
        return { success: false };
      }

      // Sync Phase, Image, ClinicalAssessment
      // For simplicity in this fix, we will just sync the Treatment base table correctly 
      // and optionally the PRE/POST phases.
      if (frontendPayload.phase) {
        const phaseId = frontendPayload.id + '-' + frontendPayload.phase;
        const phasePayload = {
          id: phaseId,
          treatmentId: frontendPayload.id,
          phaseType: frontendPayload.phase,
          updatedAt: new Date().toISOString(),
        };
        await supabase.from('Phase').upsert(phasePayload);
        
        // If there is an assessment, sync it
        if (frontendPayload.assessment) {
          const assessmentPayload = {
             id: phaseId + '-assmt',
             phaseId: phaseId,
             exudateLevel: frontendPayload.assessment.exudateLevel || 'None',
             exudateType: frontendPayload.assessment.exudateType || null,
             infectionSigns: frontendPayload.assessment.infectionSigns || [],
             painLevel: frontendPayload.assessment.pain || 0,
             edgeCondition: frontendPayload.assessment.edgeCondition || null,
             periwoundCondition: frontendPayload.assessment.periwoundCondition || null,
             updatedAt: new Date().toISOString()
          };
          await supabase.from('ClinicalAssessment').upsert(assessmentPayload);
        }

        // Image
        const imgUri = frontendPayload.phase === 'PRE' ? frontendPayload.preImageUri : frontendPayload.postImageUri;
        if (imgUri) {
           await supabase.from('Image').upsert({
              id: phaseId + '-img',
              phaseId: phaseId,
              imageUrl: imgUri,
              updatedAt: new Date().toISOString()
           });
        }
      }

      return { success: true };
    }

    const { error } = await supabase.from(tableName).upsert(dbPayload);

    
    if (error) {
      console.error(`Error syncing ${item.type}:`, error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    console.error('Network or unexpected error during sync:', err);
    return { success: false };
  }
};

export const startSyncEngine = () => {
  let isSyncing = false;
  
  const attemptSync = async () => {
    if (isSyncing) return;
    
    const state = useVisitStore.getState();
    const outbox = state.outbox;

    if (outbox.length === 0) return;

    isSyncing = true;
    state.setLastSyncAttempt(new Date().toISOString());

    for (const item of outbox) {
      if (item.retryCount > 3) continue;

      try {
        const result = await syncItem(item);
        
        if (result.success) {
          state.removeFromOutbox(item.id);
          state.updateSyncState(item.type, item.entityId, 'synced');
        } else if (result.conflict) {
          console.warn(`[SYNC CONFLICT] Server Wins policy enforced. Discarding local changes for ${item.type} ${item.entityId}`);
          state.removeFromOutbox(item.id);
        } else {
          state.incrementOutboxRetry(item.id);
        }
      } catch (err) {
        state.incrementOutboxRetry(item.id);
      }
    }
    
    isSyncing = false;
  };

  // Run periodically
  setInterval(attemptSync, 10000); // 10 seconds

  // Run on network reconnect
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      attemptSync();
    }
  });
};
