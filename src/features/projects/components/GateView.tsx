import { useState } from 'react';
import { GateReviewsScreen } from './GateReviewsScreen';
import { GateDetailScreen } from './GateDetailScreen';

export function GateView() {
  const [openGateId, setOpenGateId] = useState<string | null>(null);

  if (openGateId) {
    return (
      <GateDetailScreen
        gateId={openGateId}
        onBack={() => setOpenGateId(null)}
      />
    );
  }

  return <GateReviewsScreen onOpenGate={setOpenGateId} />;
}
