import { describe, expect, it } from 'vitest';
import { filterSpecimens, seedSpecimens, transitionSpecimen } from '../lib/specimens';

describe('specimen worklist domain', () => {
  it('searches accession, patient, department and test codes case-insensitively', () => {
    expect(filterSpecimens(seedSpecimens, 'lab-2026-001842', 'All statuses')).toHaveLength(1);
    expect(filterSpecimens(seedSpecimens, 'maha', 'All statuses')[0].patientId).toBe('PAT-004283');
    expect(filterSpecimens(seedSpecimens, 'tsh', 'All statuses')[0].accession).toBe('LAB-2026-001848');
  });
  it('filters by workflow status', () => {
    expect(filterSpecimens(seedSpecimens, '', 'Collected')).toHaveLength(3);
  });
  it('allows a valid transition from collected to in progress', () => {
    const row = seedSpecimens[1];
    expect(transitionSpecimen(row, 'In progress').status).toBe('In progress');
  });
  it('rejects skipping review and authorizing directly from collection', () => {
    expect(() => transitionSpecimen(seedSpecimens[1], 'Authorized')).toThrow(/Invalid specimen transition/);
  });
  it('does not permit changes after authorization', () => {
    expect(() => transitionSpecimen(seedSpecimens[4], 'In progress')).toThrow(/Invalid specimen transition/);
  });
});
