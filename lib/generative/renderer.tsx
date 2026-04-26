import React, { useMemo } from 'react';
import { WidgetSpecType } from './widget-spec';
import { safePalette } from '../colors';
import HeroLayout from './layouts/Hero';
import CompactLayout from './layouts/Compact';
import SplitLayout from './layouts/Split';
import FullbleedLayout from './layouts/Fullbleed';
import StickerLayout from './layouts/Sticker';

interface Props {
  spec: WidgetSpecType;
  offerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function WidgetRenderer({ spec, offerId, onAccept, onDecline }: Props) {
  // Normalize palette here so every downstream layout receives valid #RRGGBB.
  // Prevents "invalid colour value" crashes from cached offers or LLM output
  // that slipped past the server-side normalizer.
  const safeSpec = useMemo(() => ({
    ...spec,
    palette: safePalette(spec.palette),
  }), [spec]);
  const props = { spec: safeSpec, offerId, onAccept, onDecline };
  switch (safeSpec.layout) {
    case 'hero':      return <HeroLayout {...props} />;
    case 'compact':   return <CompactLayout {...props} />;
    case 'split':     return <SplitLayout {...props} />;
    case 'fullbleed': return <FullbleedLayout {...props} />;
    case 'sticker':   return <StickerLayout {...props} />;
  }
}
