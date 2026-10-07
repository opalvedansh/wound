import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { caseReportHtml, caseStatus, type Treatment } from '@antigravity-project-spec-pack/domain';
import { CheckRow, ChoiceChips, FormField } from '../components/Form';
import { FormLayout } from '../components/FormLayout';
import { Text } from '../components/Typography';
import { ageFrom, sentenceCase } from '../lib/format';
import { colors, spacing } from '../lib/theme';
import { useVisitStore } from '../store/useVisitStore';

type ParamList = {
  ReportBuilder: { caseId: string };
};

const optionFor = (t: Treatment) => `Treatment ${t.sequenceNumber}`;

/** Photos on the phone are embedded in the PDF; web pages and uploaded photos load from their address. */
const photoSource = async (uri: string | undefined): Promise<string | undefined> => {
  if (!uri) return undefined;
  if (/^(data|blob|https?):/.test(uri)) return uri;
  if (Platform.OS === 'web' || !uri.startsWith('file://')) return undefined;
  try {
    return `data:image/jpeg;base64,${await new File(uri).base64()}`;
  } catch {
    return undefined; // A missing photo leaves a gap rather than stopping the report.
  }
};

export const ReportBuilderScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ReportBuilder'>>();
  const caseId = route.params?.caseId;
  const woundCase = useVisitStore((state) => state.cases.find((c) => c.id === caseId));
  const patient = useVisitStore((state) => state.patients.find((p) => p.id === woundCase?.patientId));
  const allTreatments = useVisitStore((state) => state.treatments);

  const treatments = useMemo(
    () => allTreatments.filter((t) => t.caseId === caseId).sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [allTreatments, caseId],
  );
  // Only finished visits have a complete record to report.
  const completed = treatments.filter((t) => t.phase === 'COMPLETED');

  const [chosen, setChosen] = useState<string[]>(() => completed.map(optionFor));
  // Hidden by default: a report is often shared beyond the treating clinician.
  const [hidePersonal, setHidePersonal] = useState(true);
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const close = () => navigation.goBack();

  if (!woundCase || !patient) {
    return (
      <FormLayout title="Case report" onClose={close}>
        <Text style={styles.body}>This case isn't on this device.</Text>
      </FormLayout>
    );
  }

  const create = async () => {
    const selected = completed.filter((t) => chosen.includes(optionFor(t)));
    if (selected.length === 0) {
      setProblem('Choose at least one treatment');
      return;
    }
    setProblem(undefined);
    setBusy(true);
    try {
      const photos = new Map<string, string>();
      if (withPhotos) {
        await Promise.all(
          selected.flatMap((t) =>
            (['pre', 'post'] as const).map(async (phase) => {
              const src = await photoSource(phase === 'pre' ? t.preImageUri : t.postImageUri);
              if (src) photos.set(`${t.id}:${phase}`, src);
            }),
          ),
        );
      }
      const html = caseReportHtml({
        patient,
        age: ageFrom(patient.dob, new Date()),
        woundCase: { ...woundCase, woundLocation: sentenceCase(woundCase.woundLocation) },
        treatments: selected,
        hidePersonal,
        status: caseStatus(woundCase, treatments),
        photoSrc: withPhotos
          ? (t, phase) => {
              // A pre-treatment photo carried forward from the last visit's post photo would appear twice.
              const previous = treatments.find((p) => p.sequenceNumber === t.sequenceNumber - 1);
              if (phase === 'pre' && previous?.postImageUri && previous.postImageUri === t.preImageUri && chosen.includes(optionFor(previous))) {
                return undefined;
              }
              return photos.get(`${t.id}:${phase}`);
            }
          : undefined,
      });

      if (Platform.OS === 'web') {
        // The browser's print dialog saves it as a PDF.
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share case report' });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch {
      setProblem("The report couldn't be created. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormLayout
      title="Case report"
      subtitle={`${sentenceCase(woundCase.woundLocation) || 'Wound'} · ${completed.length} completed ${completed.length === 1 ? 'treatment' : 'treatments'}`}
      onClose={close}
      submitLabel={busy ? 'Creating PDF…' : Platform.OS === 'web' ? 'Print or save PDF' : 'Create PDF'}
      onSubmit={busy ? () => undefined : create}
    >
      {completed.length === 0 ? (
        <Text style={styles.body}>Finish a treatment to include it in a report.</Text>
      ) : (
        <View style={styles.fields}>
          <FormField label="Treatments" hint="Choose the visits to include" error={problem}>
            <ChoiceChips
              options={completed.map(optionFor)}
              value={chosen}
              onChange={(value) => setChosen(value as string[])}
              accessibilityLabel="Treatments to include"
              multiple
            />
          </FormField>

          <View style={styles.options}>
            <CheckRow
              label="Hide personal details"
              description="Leaves out the name and age. The patient ID stays so the clinic can match the report."
              value={hidePersonal}
              onChange={setHidePersonal}
            />
            <CheckRow
              label="Include wound photos"
              description="Pre- and post-treatment photos for each visit."
              value={withPhotos}
              onChange={setWithPhotos}
            />
          </View>
        </View>
      )}
    </FormLayout>
  );
};

const styles = StyleSheet.create({
  fields: {
    paddingTop: spacing.sm,
  },
  options: {
    marginTop: spacing.lg,
    gap: 4,
  },
  body: {
    marginTop: spacing.lg,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
