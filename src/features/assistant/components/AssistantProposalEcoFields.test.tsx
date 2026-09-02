import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { AssistantProposalForm } from './AssistantProposalForm';
import { ECO_FIELD_KEYS, ECO_FIELD_ORDER, ECO_FIELD_LABELS } from '../ecoProposalFields';
import type { ProposalFormState } from '../assistantData';

// The ECO editors read a few React Query hooks; the test QueryClient makes them
// resolve to empty, and every editor has an `?? []` fallback — so no network
// mock is needed, just proof the form wires ECO keys to ECO controls.

const createFormState: ProposalFormState = {
  mode: 'single',
  fields: {
    title: 'Motor housing redesign',
    description: '',
    type: 'design_change',
    reason: 'performance',
    priority: 'high',
    changeClass: 'II',
    effectivityType: 'date',
    effectivityValue: '',
    originatingEcr: '',
    revFrom: 'A',
    revTo: 'B',
    targetDate: '',
    ownerId: null,
    scheduleImpact: '',
    unitCostDelta: null,
    oneTimeCost: null,
    requiresRecertification: false,
    certNotes: '',
    firmwareCoupling: false,
    affectedModules: [],
    parts: [],
    diffRows: [],
    pipelineSteps: [],
  },
  required: ['title'],
};

describe('ecoProposalFields consistency', () => {
  it('every owned field key appears in the render order', () => {
    for (const key of ECO_FIELD_KEYS) {
      expect(ECO_FIELD_ORDER).toContain(key);
    }
  });

  it('the render order has no duplicates and every entry has a label', () => {
    expect(new Set(ECO_FIELD_ORDER).size).toBe(ECO_FIELD_ORDER.length);
    for (const key of ECO_FIELD_ORDER) {
      expect(ECO_FIELD_LABELS[key]).toBeTruthy();
    }
  });
});

describe('AssistantProposalForm — ECO', () => {
  it('renders the ECO wizard fields, in wizard-tab order, with the repeatable-row editors', () => {
    render(
      <AssistantProposalForm
        entityType="eco"
        projectId="11111111-1111-4111-8111-111111111111"
        formState={createFormState}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Shared field still renders.
    expect(screen.getByDisplayValue('Motor housing redesign')).toBeInTheDocument();
    // ECO-specific labels.
    expect(screen.getByText('Change classification')).toBeInTheDocument();
    expect(screen.getByText('Affected parts')).toBeInTheDocument();
    expect(screen.getByText('Field-level diff')).toBeInTheDocument();
    expect(screen.getByText('Approval pipeline')).toBeInTheDocument();
    // The three repeatable-row editors expose their "add" affordance.
    expect(screen.getByRole('button', { name: /add affected part/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add stage/i })).toBeInTheDocument();
  });
});
