/* ============================================================
   Icon — Phosphor line icon with the clay shadow treatment.
   Static glyph map (not namespace lookup) so Rollup tree-shakes
   the icon library instead of bundling all ~1500 glyphs.
   ============================================================ */

import {
  Pulse,
  ArrowRight,
  ArrowLeft,
  MagnifyingGlass,
  Trash,
  Notebook,
  Check,
  Fingerprint,
  FileText,
  ChartLineUp,
  UploadSimple,
  DownloadSimple,
  ChatCircleText,
  Question,
  SignOut,
  Screencast,
  Play,
  Stop,
  Circle,
  User,
  Crown,
  Flame,
  Calendar,
  EnvelopeSimple,
  Books,
  Plus,
  Copy,
  LinkSimple,
  Speedometer,
  Microphone,
  VideoCamera,
  ShieldCheck,
  CaretDown,
  ShareNetwork,
  Timer,
  X,
  List,
  Brain,
  Waveform,
} from '@phosphor-icons/react';

const GLYPHS = {
  Pulse,
  ArrowRight,
  ArrowLeft,
  Search: MagnifyingGlass,
  Trash,
  Notebook,
  Check,
  Fingerprint,
  FileText,
  Chart: ChartLineUp,
  Upload: UploadSimple,
  Download: DownloadSimple,
  ChatCircleText,
  Question,
  SignOut,
  Screens: Screencast,
  Play,
  Stop,
  User,
  Crown,
  Flame,
  Calendar,
  Envelope: EnvelopeSimple,
  Library: Books,
  Plus,
  Copy,
  Link: LinkSimple,
  Speedometer,
  Mic: Microphone,
  Camera: VideoCamera,
  Shield: ShieldCheck,
  CaretDown,
  Share: ShareNetwork,
  Timer,
  X,
  List,
  Brain,
  Waveform,
};

export function Icon({ name, size = 20, weight = 'regular', color, className = '', ...rest }) {
  const Glyph = GLYPHS[name] || Circle;
  return (
    <span className={`clay-icon-glyph ${className}`} aria-hidden="true">
      <Glyph size={size} weight={weight} color={color} {...rest} />
    </span>
  );
}
