import React from 'react';
import { WidgetSpecType } from './widget-spec';
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
  const props = { spec, offerId, onAccept, onDecline };
  switch (spec.layout) {
    case 'hero':      return <HeroLayout {...props} />;
    case 'compact':   return <CompactLayout {...props} />;
    case 'split':     return <SplitLayout {...props} />;
    case 'fullbleed': return <FullbleedLayout {...props} />;
    case 'sticker':   return <StickerLayout {...props} />;
  }
}
