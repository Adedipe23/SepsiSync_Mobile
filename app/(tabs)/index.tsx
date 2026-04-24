import React, { useMemo, useState } from 'react';
import {
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
    reasons.push('Abnormal temperature suggests systemic infection.');
  }
  if (hr >= 110) {
    score += 12;
    reasons.push('Tachycardia is consistent with physiologic stress or sepsis.');
  }
  if (rr >= 22) {
    score += 16;
    reasons.push('Respiratory rate is above common sepsis screening thresholds.');
  }
  if (sbp <= 100) {
    score += 16;
    reasons.push('Low systolic blood pressure raises concern for hypoperfusion.');
  }
  if (spo2 <= 92) {
    score += 12;
    reasons.push('Low oxygen saturation supports acute illness severity.');
  }
  if (lactate >= 2) {
    score += 14;
    reasons.push('Elevated lactate suggests impaired tissue perfusion.');
  }
  if (data.mentalStatus !== 'Alert') {
    score += 16;
    reasons.push('Altered mental status is a high-priority red flag.');
  }

  const freeText = `${data.complaint} ${data.triageNote}`.toLowerCase();
  if (
    freeText.includes('fever') ||
    freeText.includes('cough') ||
    freeText.includes('confused') ||
    freeText.includes('weakness')
  ) {
    score += 8;
    reasons.push('Free-text triage note contains infection-compatible red flags.');
  }

  const bounded = Math.min(100, score);

  let priority = 'ESI 4 - Stable';
  if (bounded >= 75) priority = 'ESI 2 - Critical';
  else if (bounded >= 50) priority = 'ESI 3 - Urgent';

  const handoff = `S: Adult patient presenting with ${data.complaint.toLowerCase()}.\nB: High-risk vital signs at intake with possible infection pattern.\nA: AI moderator flags sepsis concern score ${bounded}/100 and priority ${priority}.\nR: Immediate clinician review, early sepsis workup, and treatment escalation if confirmed.`;

  return { score: bounded, priority, reasons, handoff };
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
  const result = useMemo(() => scoreCase(form), [form]);

  const setField = <K extends keyof TriageInput>(key: K, value: TriageInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRACK B · AI AS A TEAM MEMBER</Text>
          <Text style={styles.title}>SepsiSync Mobile</Text>
          <Text style={styles.subtitle}>
            A mobile triage moderator for earlier sepsis recognition and faster team handoff.
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
                <Text
                  style={[
                    styles.segmentText,
                    form.mentalStatus === option && styles.segmentTextActive,
                  ]}
                >
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
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. AI-moderated output</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Suggested priority" value={result.priority} />
            <MetricCard label="Sepsis concern" value={`${result.score} / 100`} />
          </View>

          <Text style={styles.sectionTitle}>Why this patient is flagged</Text>
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Team collaboration</Text>
          <Text style={styles.cardSubtitle}>
            The app does not diagnose. It packages the intake data for the right clinician at the right time.
          </Text>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Send to ED physician</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Send to internal medicine</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSecondary}>
            <Text style={styles.actionButtonSecondaryText}>Escalate to ICU</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  eyebrow: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldWrap: {
    width: '48%',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
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
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  segmentActive: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  segmentText: {
    fontWeight: '700',
    color: '#334155',
  },
  segmentTextActive: {
    color: '#1d4ed8',
  },
  metricsRow: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    color: '#64748b',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: '#b91c1c',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
    marginTop: 4,
  },
  bulletBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  bulletItem: {
    fontSize: 16,
    lineHeight: 24,
    color: '#0f172a',
  },
  handoffBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
  },
  handoffText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#0f172a',
  },
  actionButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionButtonSecondary: {
    backgroundColor: '#dbeafe',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonSecondaryText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1d4ed8',
  },
});
