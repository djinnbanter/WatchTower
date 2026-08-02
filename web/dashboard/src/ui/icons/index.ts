/**
 * Site-wide icon surface: lucide-animated first, lucide-react fallback.
 * Import icons from `@/ui/icons` — never from `lucide-react` / `lucide-animated` directly in features.
 */

import {
  ActivityIcon,
  ArchiveIcon,
  ArrowDownRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeAlertIcon,
  BellElectricIcon,
  BellIcon,
  BookTextIcon,
  BoxIcon,
  BoxesIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CloudCogIcon,
  CompassIcon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  FlaskIcon,
  FolderOpenIcon,
  GaugeIcon,
  HandHelpingIcon,
  HardDriveDownloadIcon,
  HistoryIcon,
  LayersIcon,
  LayoutGridIcon,
  LockIcon,
  LogoutIcon,
  MapPinIcon,
  MenuIcon,
  MoonIcon,
  PartyPopperIcon,
  PlugZapIcon,
  RadioIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  RocketIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StethoscopeIcon,
  SunIcon,
  SunMoonIcon,
  TelescopeIcon,
  TerminalIcon,
  ThermometerIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WifiIcon,
  WrenchIcon,
  XIcon,
  ZapIcon,
} from 'lucide-animated';

import {
  AlertOctagon as LucideAlertOctagon,
  Bug as LucideBug,
  Calendar as LucideCalendar,
  Camera as LucideCamera,
  Circle as LucideCircle,
  ExternalLink as LucideExternalLink,
  FileWarning as LucideFileWarning,
  LogIn as LucideLogIn,
  Minus as LucideMinus,
  MinusCircle as LucideMinusCircle,
  Save as LucideSave,
  ScrollText as LucideScrollText,
  ShieldAlert as LucideShieldAlert,
  Monitor as LucideMonitor,
  XCircle as LucideXCircle,
} from 'lucide-react';

import { withMotionPolicy } from './withMotionPolicy';
import type { WtIcon } from './types';

export type { WtIcon, WtIconProps } from './types';

const a = withMotionPolicy;

// ── Animated (Lucide-compatible names) ──────────────────────────────────────

export const Activity = a(ActivityIcon);
export const AlertTriangle = a(BadgeAlertIcon);
export const Archive = a(ArchiveIcon);
export const ArrowDownRight = a(ArrowDownRightIcon);
export const ArrowLeft = a(ArrowLeftIcon);
export const ArrowRight = a(ArrowRightIcon);
export const ArrowUpRight = a(ArrowUpRightIcon);
export const Bell = a(BellIcon);
export const BookOpen = a(BookTextIcon);
export const Boxes = a(BoxesIcon);
export const Check = a(CheckIcon);
export const CheckCircle2 = a(CircleCheckIcon);
export const ChevronRight = a(ChevronRightIcon);
export const ClipboardList = a(ClipboardCheckIcon);
export const Clock = a(ClockIcon);
export const Clock3 = a(ClockIcon);
export const Compass = a(CompassIcon);
export const Copy = a(CopyIcon);
export const Database = a(DatabaseIcon);
export const Download = a(DownloadIcon);
export const Eclipse = a(SunMoonIcon);
export const FileText = a(FileTextIcon);
export const FlaskConical = a(FlaskIcon);
export const FolderOpen = a(FolderOpenIcon);
export const Gauge = a(GaugeIcon);
export const HardDrive = a(HardDriveDownloadIcon);
export const HardDriveDownload = a(HardDriveDownloadIcon);
export const History = a(HistoryIcon);
export const Info = a(CircleHelpIcon);
export const Layers = a(LayersIcon);
export const LayoutDashboard = a(LayoutGridIcon);
export const LifeBuoy = a(HandHelpingIcon);
export const Lock = a(LockIcon);
export const LogOut = a(LogoutIcon);
export const Map = a(MapPinIcon);
export const Menu = a(MenuIcon);
export const Microscope = a(StethoscopeIcon);
export const Moon = a(MoonIcon);
export const Network = a(WifiIcon);
export const Package = a(BoxIcon);
export const PartyPopper = a(PartyPopperIcon);
export const Power = a(PlugZapIcon);
export const Radar = a(RadioTowerIcon);
export const Radio = a(RadioIcon);
export const RadioTower = a(RadioTowerIcon);
export const RefreshCw = a(RefreshCwIcon);
export const Rocket = a(RocketIcon);
export const RotateCcw = a(RotateCcwIcon);
export const Search = a(SearchIcon);
export const Send = a(SendIcon);
export const ServerCog = a(CloudCogIcon);
export const Settings = a(SettingsIcon);
export const Settings2 = a(SettingsIcon);
export const Shield = a(ShieldCheckIcon);
export const ShieldCheck = a(ShieldCheckIcon);
export const Siren = a(BellElectricIcon);
export const SlidersHorizontal = a(SlidersHorizontalIcon);
export const Sparkles = a(SparklesIcon);
export const Sun = a(SunIcon);
export const Telescope = a(TelescopeIcon);
export const Terminal = a(TerminalIcon);
export const Thermometer = a(ThermometerIcon);
export const Timer = a(TimerIcon);
export const TrendingDown = a(TrendingDownIcon);
export const TrendingUp = a(TrendingUpIcon);
export const Users = a(UsersIcon);
export const Wrench = a(WrenchIcon);
export const X = a(XIcon);
export const Zap = a(ZapIcon);

// ── Static Lucide fallbacks (no animated twin / weak semantic match) ────────

export const AlertOctagon = LucideAlertOctagon;
export const Bug = LucideBug;
export const Calendar = LucideCalendar;
export const Camera = LucideCamera;
export const Circle = LucideCircle;
export const ExternalLink = LucideExternalLink;
export const FileWarning = LucideFileWarning;
export const LogIn = LucideLogIn;
export const Minus = LucideMinus;
export const MinusCircle = LucideMinusCircle;
export const Save = LucideSave;
export const ScrollText = LucideScrollText;
export const ShieldAlert = LucideShieldAlert;
export const Monitor = LucideMonitor;
export const XCircle = LucideXCircle;

/** Kebab-case page registry names → icon components. */
const PAGE_ICON_MAP: Record<string, WtIcon> = {
  activity: Activity,
  'alert-triangle': AlertTriangle,
  archive: Archive,
  'book-open': BookOpen,
  boxes: Boxes,
  bug: Bug,
  database: Database,
  'file-text': FileText,
  camera: Camera,
  'flask-conical': FlaskConical,
  'layout-dashboard': LayoutDashboard,
  'life-buoy': LifeBuoy,
  map: Map,
  'party-popper': PartyPopper,
  radio: Radio,
  rocket: Rocket,
  settings: Settings,
  sparkles: Zap,
  zap: Zap,
  'trending-up': TrendingUp,
  users: Users,
};

export function resolvePageIcon(name: string | undefined | null): WtIcon | null {
  if (!name) return null;
  return PAGE_ICON_MAP[name] ?? null;
}
