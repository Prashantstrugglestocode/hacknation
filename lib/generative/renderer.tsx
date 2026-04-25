import React from 'react';
import { WidgetSpecType } from './widget-spec';
import HeroLayout from './layouts/Hero';
import CompactLayout from './layouts/Compact';
import SplitLayout from './layouts/Split';
import FullbleedLayout from './layouts/Fullbleed';
import StickerLayout from './layouts/Sticker';

interface Props {
  spec: WidgetSpecType;
  onAccept: () => void;
  onDecline: () => void;
}

export default function WidgetRenderer({ spec, onAccept, onDecline }: Props) {
  switch (spec.layout) {
    case 'hero':
      return <HeroLayout spec={spec} onAccept={onAccept} onDecline={onDecline} />;
    case 'compact':
      return <CompactLayout spec={spec} onAccept={onAccept} onDecline={onDecline} />;
    case 'split':
      return <SplitLayout spec={spec} onAccept={onAccept} onDecline={onDecline} />;
    case 'fullbleed':
      return <FullbleedLayout spec={spec} onAccept={onAccept} onDecline={onDecline} />;
    case 'sticker':
      return <StickerLayout spec={spec} onAccept={onAccept} onDecline={onDecline} />;
  }
}
