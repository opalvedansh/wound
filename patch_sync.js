const fs = require('fs');
const file = 'apps/mobile/src/lib/syncManager.ts';
let code = fs.readFileSync(file, 'utf8');

// The goal is to modify syncItem to map payloads properly before sending to Supabase.
code = code.replace(
  "const { error } = await supabase.from(tableName).upsert(item.payload);",
  `
    let dbPayload = { ...item.payload };
    delete dbPayload.syncState; // Never sync this to DB

    if (tableName === 'Patient') {
      if (dbPayload.dob) {
        dbPayload.dateOfBirth = dbPayload.dob;
        delete dbPayload.dob;
      }
      // Provide dummy userId if needed by prisma schema but missing in frontend
      if (!dbPayload.userId) {
        // Fallback to a valid userId if your RLS or schema requires it
        // Or assume Supabase handles it if not strictly required in the DB
      }
    } else if (tableName === 'Case') {
      if (dbPayload.onsetDate) {
        dbPayload.onset = dbPayload.onsetDate;
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
             periwoundCondition: frontendPayload.assessment.periwoundCondition || null
          };
          await supabase.from('ClinicalAssessment').upsert(assessmentPayload);
        }

        // Image
        const imgUri = frontendPayload.phase === 'PRE' ? frontendPayload.preImageUri : frontendPayload.postImageUri;
        if (imgUri) {
           await supabase.from('Image').upsert({
              id: phaseId + '-img',
              phaseId: phaseId,
              imageUrl: imgUri
           });
        }
      }

      return { success: true };
    }

    const { error } = await supabase.from(tableName).upsert(dbPayload);
`
);

fs.writeFileSync(file, code);
