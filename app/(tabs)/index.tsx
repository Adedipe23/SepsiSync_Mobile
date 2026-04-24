import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type MentalStatus = 'Alert' | 'Confused' | 'Drowsy';
type Department = 'ED physician' | 'Internal Medicine' | 'ICU' | 'Routine Observation';

type LockedPathway = {
  department: Department;
  reason: string;
};

type TriageInput = {
  age: string;
  temperature: string;
  heartRate: string;
  respiratoryRate: string;
  systolicBP: string;
  spo2: string;
  lactate: string;
  mentalStatus: MentalStatus;
  complaint: string;
  triageNote: string;
};

type CollaborationEvent = {
  id: number;
  time: string;
  role: string;
  message: string;
};

const initialState: TriageInput = {
  age: '67',
  temperature: '39.1',
  heartRate: '118',
  respiratoryRate: '26',
  systolicBP: '94',
  spo2: '91',
  lactate: '3.2',
  mentalStatus: 'Confused',
  complaint: 'Fever, shortness of breath, weakness',
  triageNote:
    'Patient brought by daughter. Two days of productive cough, fever, and progressive weakness. Appears confused at reception. Skin warm, delayed capillary refill.',
};

function scoreCase(data: TriageInput) {
  let score = 0;
  const reasons: string[] = [];

  const age = Number(data.age);
  const temp = Number(data.temperature);
  const hr = Number(data.heartRate);
  const rr = Number(data.respiratoryRate);
  const sbp = Number(data.systolicBP);
  const spo2 = Number(data.spo2);
  const lactate = Number(data.lactate);

  if (age >= 65) {
    score += 10;
    reasons.push('Older age increases risk of rapid deterioration.');
  }
  if (temp >= 38.0 || temp <= 36.0) {
    score += 12;
    reasons.push('Abnormal temperature suggests possible systemic infection.');
  }
  if (hr >= 110) {
    score += 12;
    reasons.push('Tachycardia indicates physiological stress.');
  }
  if (rr >= 22) {
    score += 16;
    reasons.push('Raised respiratory rate is a sepsis red flag.');
  }
  if (sbp <= 90) {
    score += 22;
    reasons.push('Very low systolic blood pressure suggests possible shock.');
  } else if (sbp <= 100) {
    score += 16;
    reasons.push('Low systolic blood pressure raises concern for hypoperfusion.');
  }
  if (spo2 <= 90) {
    score += 18;
    reasons.push('Very low oxygen saturation suggests immediate respiratory risk.');
  } else if (spo2 <= 92) {
    score += 12;
    reasons.push('Low oxygen saturation supports acute illness severity.');
  }
  if (lactate >= 4) {
    score += 22;
    reasons.push('Severely elevated lactate suggests high risk of septic shock.');
  } else if (lactate >= 2) {
    score += 14;
    reasons.push('Elevated lactate suggests impaired tissue perfusion.');
  }
  if (data.mentalStatus !== 'Alert') {
    score += 16;
    reasons.push('Altered mental status is a high-priority red flag.');
  }

  const freeText = `${data.complaint} ${data.triageNote}`.toLowerCase();
  const infectionKeywords = ['fever', 'cough', 'infection', 'weakness', 'confused', 'shortness of breath'];
  if (infectionKeywords.some((word) => freeText.includes(word))) {
    score += 8;
    reasons.push('Free-text triage note contains infection-compatible symptoms.');
  }

  const bounded = Math.min(100, score);

  let priority = 'ESI 4 - Stable';
  if (bounded >= 75) priority = 'ESI 2 - Critical';
  else if (bounded >= 50) priority = 'ESI 3 - Urgent';

  const pathway = chooseDepartment({
    score: bounded,
    systolicBP: sbp,
    spo2,
    lactate,
    mentalStatus: data.mentalStatus,
    respiratoryRate: rr,
    text: freeText,
  });

  const handoff = `S: Adult patient presenting with ${data.complaint.toLowerCase()}.
B: Triage data suggests ${pathway.department.toLowerCase()} pathway.
A: Sepsis concern score ${bounded}/100. Priority: ${priority}.
R: Refer to ${pathway.department}. Reason: ${pathway.reason}`;

  return {
    score: bounded,
    priority,
    reasons,
    handoff,
    department: pathway.department,
    departmentReason: pathway.reason,
    nextAction: pathway.nextAction,
    lockedPathways: pathway.lockedPathways,
  };
}

function chooseDepartment(input: {
  score: number;
  systolicBP: number;
  spo2: number;
  lactate: number;
  mentalStatus: MentalStatus;
  respiratoryRate: number;
  text: string;
}): { department: Department; reason: string; nextAction: string; lockedPathways: LockedPathway[] } {
  const shockRisk = input.systolicBP <= 90 || input.lactate >= 4 || input.spo2 <= 90;
  const unstable = input.score >= 85 || shockRisk;
  const urgent = input.score >= 60 || input.mentalStatus !== 'Alert' || input.respiratoryRate >= 22;
  const medicinePattern =
    input.text.includes('fever') ||
    input.text.includes('cough') ||
    input.text.includes('infection') ||
    input.text.includes('weakness');

  if (unstable) {
    return {
      department: 'ICU',
      reason:
        'The patient shows signs of possible physiological instability, such as shock risk, severe hypoxia, very high lactate, or very high sepsis concern.',
      nextAction:
        'Trigger ICU escalation for urgent review and prepare advanced monitoring or organ-support assessment.',
      lockedPathways: [
        {
          department: 'ED physician',
          reason: 'Locked because this case has already exceeded the emergency-review threshold and requires ICU-level escalation.',
        },
        {
          department: 'Internal Medicine',
          reason: 'Locked because the patient is not stable enough for a routine medical referral pathway.',
        },
        {
          department: 'Routine Observation',
          reason: 'Locked because the risk level is too high for observation only.',
        },
      ],
    };
  }

  if (urgent && input.systolicBP <= 100) {
    return {
      department: 'ED physician',
      reason:
        'The case is urgent and requires immediate emergency physician review because vital signs indicate possible deterioration.',
      nextAction:
        'Request ED physician review for rapid bedside assessment and immediate treatment decision.',
      lockedPathways: [
        {
          department: 'Internal Medicine',
          reason: 'Locked because the patient needs immediate emergency review before a medical admission pathway is selected.',
        },
        {
          department: 'ICU',
          reason: 'Locked because shock-level criteria such as severe hypoxia, lactate ≥ 4, or very low blood pressure are not present.',
        },
        {
          department: 'Routine Observation',
          reason: 'Locked because the case is too urgent for observation only.',
        },
      ],
    };
  }

  if (medicinePattern || input.score >= 35) {
    return {
      department: 'Internal Medicine',
      reason:
        'The patient appears clinically stable enough for medical referral, but the symptoms suggest an internal or infectious disease pathway requiring diagnostic workup and treatment planning.',
      nextAction:
        'Refer to Internal Medicine for admission assessment, infection source investigation, lab review, and treatment planning.',
      lockedPathways: [
        {
          department: 'ED physician',
          reason: 'Locked because no immediate emergency instability is detected in the current analysis.',
        },
        {
          department: 'ICU',
          reason: 'Locked because there is no shock, severe hypoxia, very high lactate, or organ-support criterion detected.',
        },
        {
          department: 'Routine Observation',
          reason: 'Locked because the symptoms still require medical diagnostic workup rather than observation only.',
        },
      ],
    };
  }

  return {
    department: 'Routine Observation',
    reason:
      'The current data does not indicate urgent escalation. The patient should remain under observation with repeated vital-sign checks.',
    nextAction: 'Continue monitoring and repeat assessment if symptoms or vital signs change.',
    lockedPathways: [
      {
        department: 'ED physician',
        reason: 'Locked because no immediate emergency instability is detected.',
      },
      {
        department: 'Internal Medicine',
        reason: 'Locked because the current symptoms do not yet suggest a clear medical admission pathway.',
      },
      {
        department: 'ICU',
        reason: 'Locked because no shock, severe hypoxia, high lactate, or organ-support criteria are present.',
      },
    ],
  };
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholder={label}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [form, setForm] = useState<TriageInput>(initialState);
  const [submitted, setSubmitted] = useState(false);
  const [collaborationLog, setCollaborationLog] = useState<CollaborationEvent[]>([]);

  const result = useMemo(() => scoreCase(form), [form]);

  const setField = <K extends keyof TriageInput>(key: K, value: TriageInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitted(false);
    setCollaborationLog([]);
  };

  const handleAnalyse = () => {
    setSubmitted(true);
    setCollaborationLog([
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        role: 'AI moderator',
        message: `Analysis complete. Recommended department: ${result.department}. Reason: ${result.departmentReason}`,
      },
    ]);
  };

  const handleTeamAction = (department: Department) => {
    if (!submitted) {
      Alert.alert('Analyse patient first', 'Please tap Analyse Patient before sending a handoff.');
      return;
    }

    if (department !== result.department) {
      Alert.alert(
        'Pathway locked',
        `This case fits the ${result.department} pathway only. Other departments are disabled to prevent inappropriate referral.`
      );
      return;
    }

    const newEvent: CollaborationEvent = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      role: result.department,
      message: `${result.nextAction} Handoff includes priority ${result.priority}, sepsis concern ${result.score}/100, and SBAR summary.`,
    };

    setCollaborationLog((prev) => [newEvent, ...prev]);
    Alert.alert('Referral sent', `The case was referred to ${result.department}.`);
  };

  const handleReset = () => {
    setForm(initialState);
    setSubmitted(false);
    setCollaborationLog([]);
  };

  const isAllowed = (department: Department) => submitted && result.department === department;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRACK B · AI AS A TEAM MEMBER</Text>
          <Text style={styles.title}>SepsiSync Mobile</Text>
          <Text style={styles.subtitle}>
            A mobile triage moderator that recommends one appropriate clinical pathway after patient analysis.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Triage intake</Text>
          <Text style={styles.cardSubtitle}>Enter the first-minute information available to the triage nurse.</Text>

          <View style={styles.grid}>
            <Field label="Age" value={form.age} onChangeText={(v) => setField('age', v)} />
            <Field label="Temperature °C" value={form.temperature} onChangeText={(v) => setField('temperature', v)} />
            <Field label="Heart rate / min" value={form.heartRate} onChangeText={(v) => setField('heartRate', v)} />
            <Field label="Respiratory rate / min" value={form.respiratoryRate} onChangeText={(v) => setField('respiratoryRate', v)} />
            <Field label="Systolic BP mmHg" value={form.systolicBP} onChangeText={(v) => setField('systolicBP', v)} />
            <Field label="SpO₂ %" value={form.spo2} onChangeText={(v) => setField('spo2', v)} />
            <Field label="Lactate mmol/L" value={form.lactate} onChangeText={(v) => setField('lactate', v)} />
          </View>

          <Text style={styles.label}>Mental status</Text>
          <View style={styles.segmentRow}>
            {(['Alert', 'Confused', 'Drowsy'] as MentalStatus[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segment, form.mentalStatus === option && styles.segmentActive]}
                onPress={() => setField('mentalStatus', option)}
              >
                <Text style={[styles.segmentText, form.mentalStatus === option && styles.segmentTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Chief complaint" value={form.complaint} onChangeText={(v) => setField('complaint', v)} />
          <Text style={styles.label}>Triage note</Text>
          <TextInput
            multiline
            value={form.triageNote}
            onChangeText={(v) => setField('triageNote', v)}
            style={[styles.input, styles.textarea]}
            placeholder="Enter a short triage summary"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAnalyse}>
              <Text style={styles.primaryButtonText}>Analyse Patient</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {submitted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. AI recommendation</Text>
            <View style={styles.metricsRow}>
              <MetricCard label="Suggested priority" value={result.priority} />
              <MetricCard label="Sepsis concern" value={`${result.score} / 100`} />
            </View>

            <View style={styles.recommendationBox}>
              <Text style={styles.recommendationLabel}>Required department</Text>
              <Text style={styles.recommendationDepartment}>{result.department}</Text>
              <Text style={styles.recommendationReason}>{result.departmentReason}</Text>
              <Text style={styles.nextAction}>{result.nextAction}</Text>
            </View>

            <Text style={styles.sectionTitle}>Locked pathways</Text>
            <View style={styles.lockedBox}>
              {result.lockedPathways.map((pathway) => (
                <View key={pathway.department} style={styles.lockedItem}>
                  <Text style={styles.lockedDepartment}>{pathway.department} locked</Text>
                  <Text style={styles.lockedReason}>{pathway.reason}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Why this pathway was selected</Text>
            <View style={styles.bulletBox}>
              {result.reasons.map((reason) => (
                <Text key={reason} style={styles.bulletItem}>{`• ${reason}`}</Text>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Structured handoff (SBAR)</Text>
            <View style={styles.handoffBox}>
              <Text style={styles.handoffText}>{result.handoff}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Team collaboration</Text>
          <Text style={styles.cardSubtitle}>
            After analysis, only the clinically recommended department can be selected. Other pathways are locked.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, !isAllowed('ED physician') && styles.disabledButton]}
            disabled={!isAllowed('ED physician')}
            onPress={() => handleTeamAction('ED physician')}
          >
            <Text style={[styles.actionButtonText, !isAllowed('ED physician') && styles.disabledButtonText]}>
              Request ED physician review
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, !isAllowed('Internal Medicine') && styles.disabledButton]}
            disabled={!isAllowed('Internal Medicine')}
            onPress={() => handleTeamAction('Internal Medicine')}
          >
            <Text style={[styles.actionButtonText, !isAllowed('Internal Medicine') && styles.disabledButtonText]}>
              Refer to Internal Medicine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonSecondary, !isAllowed('ICU') && styles.disabledButton]}
            disabled={!isAllowed('ICU')}
            onPress={() => handleTeamAction('ICU')}
          >
            <Text style={[styles.actionButtonSecondaryText, !isAllowed('ICU') && styles.disabledButtonText]}>
              Trigger ICU escalation
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Shared team timeline</Text>
          <View style={styles.timelineBox}>
            {collaborationLog.length === 0 ? (
              <Text style={styles.timelineEmpty}>
                Analyse the patient first. The system will then unlock only the appropriate clinical pathway.
              </Text>
            ) : (
              collaborationLog.map((event) => (
                <View key={event.id} style={styles.timelineItem}>
                  <Text style={styles.timelineTime}>{event.time}</Text>
                  <Text style={styles.timelineRole}>{event.role}</Text>
                  <Text style={styles.timelineMessage}>{event.message}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  header: { gap: 6, marginBottom: 4 },
  eyebrow: { color: '#2563eb', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 34, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 16, lineHeight: 22, color: '#475569' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  cardTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  cardSubtitle: { fontSize: 15, color: '#64748b', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldWrap: { width: '48%', gap: 6 },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  segmentActive: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#60a5fa' },
  segmentText: { fontWeight: '700', color: '#334155' },
  segmentTextActive: { color: '#1d4ed8' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  resetButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  resetButtonText: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  metricsRow: { gap: 12 },
  metricCard: { backgroundColor: '#fee2e2', borderRadius: 18, padding: 14, gap: 6 },
  metricLabel: {
    color: '#64748b',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metricValue: { color: '#b91c1c', fontSize: 18, fontWeight: '800' },
  recommendationBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  recommendationLabel: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recommendationDepartment: { color: '#0f172a', fontSize: 24, fontWeight: '900' },
  recommendationReason: { color: '#334155', fontSize: 16, lineHeight: 23 },
  nextAction: { color: '#1d4ed8', fontSize: 16, fontWeight: '800', lineHeight: 23 },
  lockedBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  lockedItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  lockedDepartment: {
    color: '#9a3412',
    fontSize: 16,
    fontWeight: '900',
  },
  lockedReason: {
    color: '#7c2d12',
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#475569', marginTop: 4 },
  bulletBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  bulletItem: { fontSize: 16, lineHeight: 24, color: '#0f172a' },
  handoffBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
  },
  handoffText: { fontSize: 16, lineHeight: 24, color: '#0f172a' },
  actionButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonText: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  actionButtonSecondary: {
    backgroundColor: '#dbeafe',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonSecondaryText: { fontSize: 18, fontWeight: '800', color: '#1d4ed8' },
  disabledButton: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  disabledButtonText: { color: '#94a3b8' },
  timelineBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  timelineEmpty: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  timelineItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  timelineTime: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  timelineRole: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  timelineMessage: { color: '#475569', fontSize: 15, lineHeight: 21 },
});
