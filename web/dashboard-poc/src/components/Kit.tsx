import { useState, type ReactNode } from 'react';
import { Bar, BarChart, XAxis } from 'recharts';
import { PageHeader } from './PageHero';
import { Plate } from './Plate';
import { DeskPage } from './layout/DeskPage';
import { KitProductSurface } from './KitProductSurface';
import { KitMessageScrollerDemo, KitQuestionnaireDemo } from './KitChatDemos';
import { KitComboboxDemo } from './KitComboboxDemo';
import { HashMeter, RingGauge, SeriesChart, SparkBars } from './charts';
import { MetaButton } from '@/components/ui/desk';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble';
import {
  Message,
  MessageContent,
} from '@/components/ui/message';
import {
  Attachment,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from '@/components/ui/attachment';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Toaster, toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'product-charts', label: 'Product charts' },
  { id: 'desk-patterns', label: 'Desk patterns' },
  { id: 'actions', label: 'Actions' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'data', label: 'Data' },
  { id: 'chat', label: 'Chat / AI' },
  { id: 'charts', label: 'Shadcn chart' },
  { id: 'shell', label: 'Shell' },
  { id: 'utils', label: 'Hooks / utils' },
] as const;

function KitBlock({
  id,
  file,
  children,
  className,
}: {
  id: string;
  file: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn(className)}>
      <Plate className="overflow-hidden">
        <div className="flex h-10 items-center border-b border-border px-4">
          <p className="m-0 font-mono text-[0.7rem] text-muted-foreground">{file}</p>
        </div>
        <div className="space-y-3 p-4 md:p-5">{children}</div>
      </Plate>
    </div>
  );
}

function Category({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="wt-meta m-0 text-muted-foreground">{title}</h2>
      <div className="grid gap-3 lg:grid-cols-2">{children}</div>
    </section>
  );
}

const sparkSample = [0.2, 0.35, 0.3, 0.55, 0.4, 0.7, 0.5, 0.65, 0.45, 0.8, 0.6, 0.72];
const seriesSample = Array.from({ length: 24 }, (_, i) => 0.35 + Math.sin(i / 3) * 0.2 + (i % 5) * 0.02);
const miniChart = [
  { step: 'a', v: 12 },
  { step: 'b', v: 18 },
  { step: 'c', v: 9 },
  { step: 'd', v: 22 },
  { step: 'e', v: 15 },
];
const miniChartConfig = { v: { label: 'Load', color: 'var(--primary)' } } satisfies ChartConfig;

/**
 * Lab → Kit — canonical base-lyra / Base UI demos under WatchTower POC theme.
 */
export function Kit() {
  const [slider, setSlider] = useState([42]);
  const [otp, setOtp] = useState('');
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [openCol, setOpenCol] = useState(true);

  return (
    <Toaster>
      <TooltipProvider>
        <DeskPage>
            <PageHeader
              group="Lab"
              title="Kit"
              sub="Canonical shadcn · Base UI (Lyra) under WatchTower theme. Copy these patterns into product pages."
            />

            <nav
              aria-label="Kit categories"
              className="sticky top-0 z-20 -mx-4 flex gap-px overflow-x-auto border-y border-border bg-background px-4 py-2 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
            >
              {CATEGORIES.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="shrink-0 border border-border bg-card px-3 py-2 wt-meta text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </a>
              ))}
            </nav>

            <KitProductSurface />

            {/* ACTIONS */}
            <Category id="actions" title="Actions">
              <KitBlock id="kit-button" file="ui/button.tsx">
                <div className="flex flex-wrap gap-2">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs">XS</Button>
                  <Button size="sm">SM</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">LG</Button>
                </div>
              </KitBlock>

              <KitBlock id="kit-button-group" file="ui/button-group.tsx">
                <ButtonGroup>
                  <Button variant="outline">15m</Button>
                  <Button variant="outline">1h</Button>
                  <Button variant="outline">6h</Button>
                </ButtonGroup>
              </KitBlock>

              <KitBlock id="kit-toggle" file="ui/toggle.tsx">
                <Toggle aria-label="Watching" defaultPressed>
                  Watching
                </Toggle>
              </KitBlock>

              <KitBlock id="kit-toggle-group" file="ui/toggle-group.tsx">
                <ToggleGroup defaultValue={['bar']}>
                  <ToggleGroupItem value="bar">Bar</ToggleGroupItem>
                  <ToggleGroupItem value="line">Line</ToggleGroupItem>
                </ToggleGroup>
              </KitBlock>
            </Category>

            {/* INPUTS */}
            <Category id="inputs" title="Inputs">
              <KitBlock id="kit-input" file="ui/input.tsx">
                <Label htmlFor="kit-in">Server name</Label>
                <Input id="kit-in" placeholder="create-smp" className="mt-2" />
              </KitBlock>

              <KitBlock id="kit-textarea" file="ui/textarea.tsx">
                <Label htmlFor="kit-ta">Notes</Label>
                <Textarea id="kit-ta" placeholder="Ops note…" className="mt-2" rows={3} />
              </KitBlock>

              <KitBlock id="kit-checkbox" file="ui/checkbox.tsx">
                <div className="flex items-center gap-2">
                  <Checkbox id="kit-cb" defaultChecked />
                  <Label htmlFor="kit-cb">Include Spark evidence</Label>
                </div>
              </KitBlock>

              <KitBlock id="kit-radio" file="ui/radio-group.tsx">
                <RadioGroup defaultValue="warn" className="gap-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ok" id="r-ok" />
                    <Label htmlFor="r-ok">OK</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="warn" id="r-warn" />
                    <Label htmlFor="r-warn">Warn</Label>
                  </div>
                </RadioGroup>
              </KitBlock>

              <KitBlock id="kit-switch" file="ui/switch.tsx">
                <div className="flex items-center gap-2">
                  <Switch id="kit-sw" defaultChecked />
                  <Label htmlFor="kit-sw">Always-on ops scan</Label>
                </div>
              </KitBlock>

              <KitBlock id="kit-slider" file="ui/slider.tsx">
                <Label>Threshold · {slider[0]}%</Label>
                <Slider
                  className="mt-3"
                  value={slider}
                  onValueChange={(v) => setSlider(Array.isArray(v) ? [...v] : [v])}
                  max={100}
                  step={1}
                />
              </KitBlock>

              <KitBlock id="kit-select" file="ui/select.tsx">
                <Select defaultValue="1h">
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15m">15m</SelectItem>
                    <SelectItem value="1h">1h</SelectItem>
                    <SelectItem value="6h">6h</SelectItem>
                  </SelectContent>
                </Select>
              </KitBlock>

              <KitBlock id="kit-native-select" file="ui/native-select.tsx">
                <NativeSelect defaultValue="neo" aria-label="Loader">
                  <NativeSelectOption value="neo">NeoForge</NativeSelectOption>
                  <NativeSelectOption value="fab">Fabric</NativeSelectOption>
                </NativeSelect>
              </KitBlock>

              <KitBlock id="kit-otp" file="ui/input-otp.tsx">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </KitBlock>

              <KitBlock id="kit-input-group" file="ui/input-group.tsx">
                <InputGroup>
                  <InputGroupAddon>Port</InputGroupAddon>
                  <InputGroupInput defaultValue="8787" />
                </InputGroup>
              </KitBlock>

              <KitBlock id="kit-field" file="ui/field.tsx">
                <Field>
                  <FieldLabel>Dashboard bind</FieldLabel>
                  <FieldContent>
                    <Input defaultValue="127.0.0.1" />
                    <FieldDescription>Prefer localhost / SSH tunnel.</FieldDescription>
                  </FieldContent>
                </Field>
              </KitBlock>

              <KitBlock id="kit-calendar" file="ui/calendar.tsx" className="lg:col-span-2">
                <Calendar mode="single" selected={day} onSelect={setDay} className="rounded-none border border-border" />
              </KitBlock>
            </Category>

            {/* FEEDBACK */}
            <Category id="feedback" title="Feedback">
              <KitBlock id="kit-badge" file="ui/badge.tsx">
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </KitBlock>

              <KitBlock id="kit-alert" file="ui/alert.tsx">
                <Alert>
                  <AlertTitle>MSPT warm</AlertTitle>
                  <AlertDescription>Near budget with 12 players online.</AlertDescription>
                </Alert>
              </KitBlock>

              <KitBlock id="kit-progress" file="ui/progress.tsx">
                <Progress value={62} className="w-full gap-2">
                  <div className="mb-1 flex w-full justify-between">
                    <ProgressLabel>Disk</ProgressLabel>
                    <ProgressValue />
                  </div>
                </Progress>
              </KitBlock>

              <KitBlock id="kit-spinner" file="ui/spinner.tsx">
                <Spinner />
              </KitBlock>

              <KitBlock id="kit-skeleton" file="ui/skeleton.tsx">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </KitBlock>

              <KitBlock id="kit-empty" file="ui/empty.tsx">
                <Empty className="border border-border py-8">
                  <EmptyHeader>
                    <EmptyTitle>No crashes</EmptyTitle>
                    <EmptyDescription>Inbox is clear for this lookback.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </KitBlock>

              <KitBlock id="kit-toast" file="ui/toast.tsx">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    toast.add({
                      title: 'Scan queued',
                      description: 'Light sample scheduled.',
                      type: 'success',
                    })
                  }
                >
                  Fire toast
                </Button>
              </KitBlock>

              <KitBlock id="kit-kbd" file="ui/kbd.tsx">
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </KitBlock>

              <KitBlock id="kit-marker" file="ui/marker.tsx">
                <Marker>
                  <MarkerContent>Critical path</MarkerContent>
                </Marker>
              </KitBlock>
            </Category>

            {/* OVERLAY */}
            <Category id="overlay" title="Overlay">
              <KitBlock id="kit-dialog" file="ui/dialog.tsx">
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm restart advice</DialogTitle>
                      <DialogDescription>
                        Advisory only — WatchTower does not restart the server.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button>Got it</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </KitBlock>

              <KitBlock id="kit-alert-dialog" file="ui/alert-dialog.tsx">
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="destructive" />}>
                    Delete draft
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete support draft?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </KitBlock>

              <KitBlock id="kit-sheet" file="ui/sheet.tsx">
                <Sheet>
                  <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Issue detail</SheetTitle>
                      <SheetDescription>Side panel template.</SheetDescription>
                    </SheetHeader>
                  </SheetContent>
                </Sheet>
              </KitBlock>

              <KitBlock id="kit-drawer" file="ui/drawer.tsx">
                <Drawer>
                  <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Mobile ops tray</DrawerTitle>
                      <DrawerDescription>Bottom sheet pattern.</DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter>
                      <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </KitBlock>

              <KitBlock id="kit-popover" file="ui/popover.tsx">
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" />}>Popover</PopoverTrigger>
                  <PopoverContent className="w-56 text-sm">Filter presets live here.</PopoverContent>
                </Popover>
              </KitBlock>

              <KitBlock id="kit-hover-card" file="ui/hover-card.tsx">
                <HoverCard>
                  <HoverCardTrigger render={<Button variant="link" />}>djinn</HoverCardTrigger>
                  <HoverCardContent className="w-56 text-sm">
                    Owner · last active 3s ago
                  </HoverCardContent>
                </HoverCard>
              </KitBlock>

              <KitBlock id="kit-tooltip" file="ui/tooltip.tsx">
                <Tooltip>
                  <TooltipTrigger render={<Button variant="outline" />}>Hover tip</TooltipTrigger>
                  <TooltipContent>Polled every ~5s</TooltipContent>
                </Tooltip>
              </KitBlock>

              <KitBlock id="kit-context-menu" file="ui/context-menu.tsx">
                <ContextMenu>
                  <ContextMenuTrigger className="flex h-20 items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
                    Right-click me
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem>Open</ContextMenuItem>
                    <ContextMenuItem>Copy id</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </KitBlock>

              <KitBlock id="kit-dropdown" file="ui/dropdown-menu.tsx">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" />}>Menu</DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Export brief</DropdownMenuItem>
                    <DropdownMenuItem>Copy link</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </KitBlock>
            </Category>

            {/* NAVIGATION */}
            <Category id="navigation" title="Navigation">
              <KitBlock id="kit-breadcrumb" file="ui/breadcrumb.tsx">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Monitor</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Live</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </KitBlock>

              <KitBlock id="kit-pagination" file="ui/pagination.tsx">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" isActive>
                        1
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#">2</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext href="#" />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </KitBlock>

              <KitBlock id="kit-tabs" file="ui/tabs.tsx">
                <Tabs defaultValue="live">
                  <TabsList>
                    <TabsTrigger value="live">Live</TabsTrigger>
                    <TabsTrigger value="startup">Startup</TabsTrigger>
                  </TabsList>
                  <TabsContent value="live" className="text-sm text-muted-foreground">
                    Live metrics pane.
                  </TabsContent>
                  <TabsContent value="startup" className="text-sm text-muted-foreground">
                    Boot timeline pane.
                  </TabsContent>
                </Tabs>
              </KitBlock>

              <KitBlock id="kit-nav-menu" file="ui/navigation-menu.tsx">
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuLink href="#" className="px-3 py-2 text-sm">
                        Overview
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                      <NavigationMenuLink href="#" className="px-3 py-2 text-sm">
                        Issues
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </KitBlock>

              <KitBlock id="kit-menubar" file="ui/menubar.tsx">
                <Menubar>
                  <MenubarMenu>
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem>Export pack</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>View</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem>Toggle theme</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>
              </KitBlock>

              <KitBlock id="kit-accordion" file="ui/accordion.tsx">
                <Accordion>
                  <AccordionItem value="a">
                    <AccordionTrigger>What is Watching?</AccordionTrigger>
                    <AccordionContent>Continuous light samples into Issues.</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="b">
                    <AccordionTrigger>Support packs</AccordionTrigger>
                    <AccordionContent>Redacted zip for handoff.</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </KitBlock>

              <KitBlock id="kit-collapsible" file="ui/collapsible.tsx">
                <Collapsible open={openCol} onOpenChange={setOpenCol}>
                  <CollapsibleTrigger render={<MetaButton />}>
                    {openCol ? 'Hide detail' : 'Show detail'}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 text-sm text-muted-foreground">
                    Collapsible body for denser plates.
                  </CollapsibleContent>
                </Collapsible>
              </KitBlock>
            </Category>

            {/* DATA */}
            <Category id="data" title="Data display">
              <KitBlock id="kit-card" file="ui/card.tsx">
                <Card>
                  <CardHeader>
                    <CardTitle>Health</CardTitle>
                    <CardDescription>Tick is fine</CardDescription>
                  </CardHeader>
                  <CardContent className="font-mono text-2xl tabular-nums">19.4 TPS</CardContent>
                </Card>
              </KitBlock>

              <KitBlock id="kit-table" file="ui/table.tsx">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>MSPT</TableCell>
                      <TableCell className="font-mono">48 ms</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Players</TableCell>
                      <TableCell className="font-mono">12</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </KitBlock>

              <KitBlock id="kit-avatar" file="ui/avatar.tsx">
                <Avatar>
                  <AvatarFallback>DJ</AvatarFallback>
                </Avatar>
              </KitBlock>

              <KitBlock id="kit-aspect" file="ui/aspect-ratio.tsx">
                <AspectRatio ratio={16 / 9} className="border border-border bg-muted" />
              </KitBlock>

              <KitBlock id="kit-scroll" file="ui/scroll-area.tsx">
                <ScrollArea className="h-24 border border-border p-3 text-sm">
                  {Array.from({ length: 12 }, (_, i) => (
                    <p key={i} className="m-0 py-1 text-muted-foreground">
                      Log line {i + 1}
                    </p>
                  ))}
                </ScrollArea>
              </KitBlock>

              <KitBlock id="kit-resizable" file="ui/resizable.tsx">
                <ResizablePanelGroup orientation="horizontal" className="min-h-24 border border-border">
                  <ResizablePanel defaultSize={60} className="bg-card p-3 text-xs">
                    Left
                  </ResizablePanel>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={40} className="bg-muted p-3 text-xs">
                    Right
                  </ResizablePanel>
                </ResizablePanelGroup>
              </KitBlock>

              <KitBlock id="kit-separator" file="ui/separator.tsx">
                <div className="space-y-2 text-sm">
                  <p className="m-0">Above</p>
                  <Separator />
                  <p className="m-0">Below</p>
                </div>
              </KitBlock>

              <KitBlock id="kit-item" file="ui/item.tsx">
                <Item variant="outline">
                  <ItemContent>
                    <ItemTitle>Disk runway</ItemTitle>
                    <ItemDescription>~11 days at current growth</ItemDescription>
                  </ItemContent>
                </Item>
              </KitBlock>

              <KitBlock id="kit-carousel" file="ui/carousel.tsx" className="lg:col-span-2">
                <Carousel className="w-full max-w-md">
                  <CarouselContent>
                    {['TPS', 'MSPT', 'Heap'].map((label) => (
                      <CarouselItem key={label}>
                        <div className="border border-border bg-card p-6 text-center font-mono">
                          {label}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              </KitBlock>
            </Category>

            {/* CHAT */}
            <Category id="chat" title="Chat / AI (registry)">
              <KitBlock id="kit-bubble" file="ui/bubble.tsx">
                <BubbleGroup>
                  <Bubble>
                    <BubbleContent>Server still okay?</BubbleContent>
                  </Bubble>
                </BubbleGroup>
              </KitBlock>

              <KitBlock id="kit-message" file="ui/message.tsx">
                <Message>
                  <MessageContent className="rounded-none border border-border bg-card px-3 py-2 text-sm">
                    Tick is fine. MSPT is warm from evening play.
                  </MessageContent>
                </Message>
              </KitBlock>

              <KitBlock id="kit-attachment" file="ui/attachment.tsx">
                <Attachment state="done">
                  <AttachmentContent>
                    <AttachmentTitle>latest.log</AttachmentTitle>
                    <AttachmentDescription>Support evidence</AttachmentDescription>
                  </AttachmentContent>
                </Attachment>
              </KitBlock>

              <KitBlock id="kit-message-scroller" file="ui/message-scroller.tsx" className="lg:col-span-2">
                <KitMessageScrollerDemo />
              </KitBlock>

              <KitBlock id="kit-questionnaire" file="ui/questionnaire.tsx" className="lg:col-span-2">
                <KitQuestionnaireDemo />
              </KitBlock>
            </Category>

            {/* SHADCN CHART SCAFFOLD */}
            <Category id="charts" title="Shadcn chart scaffold">
              <KitBlock id="kit-chart" file="ui/chart.tsx">
                <ChartContainer config={miniChartConfig} className="h-32 w-full aspect-auto">
                  <BarChart data={miniChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="step" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="v" fill="var(--color-v)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </KitBlock>

              <KitBlock id="kit-series" file="charts/SeriesChart.tsx">
                <SeriesChart
                  points={24}
                  windowMs={60 * 60 * 1000}
                  unit="ms"
                  valueAtFull={50}
                  tracks={[{ id: 'mspt', label: 'MSPT', series: seriesSample, color: 'var(--primary)' }]}
                />
              </KitBlock>

              <KitBlock id="kit-spark" file="charts/SparkBars.tsx">
                <SparkBars samples={sparkSample} />
              </KitBlock>

              <KitBlock id="kit-hash" file="charts/HashMeter.tsx">
                <HashMeter value={62} />
              </KitBlock>

              <KitBlock id="kit-ring" file="ui/chart · Radial shape" className="lg:col-span-2">
                <Card className="flex flex-col rounded-none">
                  <CardHeader className="items-center pb-0">
                    <CardTitle>Disk used</CardTitle>
                    <CardDescription>Live disk ring on the desk</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pb-0">
                    <RingGauge
                      pct={71}
                      ink="var(--primary)"
                      label="used"
                      sizeClassName="mx-auto aspect-square max-h-[250px] w-full"
                    />
                  </CardContent>
                </Card>
              </KitBlock>
            </Category>

            {/* SHELL */}
            <Category id="shell" title="Shell">
              <KitBlock id="kit-command" file="ui/command.tsx" className="lg:col-span-2">
                <Command className="rounded-none border border-border">
                  <CommandInput placeholder="Jump to…" />
                  <CommandList>
                    <CommandEmpty>No match.</CommandEmpty>
                    <CommandGroup heading="Pages">
                      <CommandItem>Overview</CommandItem>
                      <CommandItem>Live</CommandItem>
                      <CommandItem>Issues</CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </KitBlock>

              <KitBlock id="kit-sidebar" file="ui/sidebar.tsx" className="lg:col-span-2">
                <SidebarProvider className="min-h-[16rem] border border-border">
                  <Sidebar collapsible="none" className="border-r border-border">
                    <SidebarHeader className="px-3 py-2 wt-meta text-primary">WatchTower</SidebarHeader>
                    <SidebarContent>
                      <SidebarGroup>
                        <SidebarGroupLabel>Lab</SidebarGroupLabel>
                        <SidebarMenu>
                          <SidebarMenuItem>
                            <SidebarMenuButton isActive>Kit</SidebarMenuButton>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <SidebarMenuButton>Tokens</SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      </SidebarGroup>
                    </SidebarContent>
                  </Sidebar>
                  <SidebarInset className="p-4">
                    <SidebarTrigger />
                    <p className="mt-2 m-0 text-sm text-muted-foreground">Inset content</p>
                  </SidebarInset>
                </SidebarProvider>
              </KitBlock>

              <KitBlock id="kit-combobox" file="ui/combobox.tsx">
                <KitComboboxDemo />
              </KitBlock>
            </Category>

            {/* UTILS */}
            <Category id="utils" title="Hooks / utils">
              <KitBlock id="kit-hooks" file="hooks/use-mobile.ts" className="lg:col-span-2">
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <code className="font-mono text-foreground">hooks/use-mobile.ts</code> — sidebar
                    breakpoint helper
                  </li>
                  <li>
                    <code className="font-mono text-foreground">lib/utils.ts</code> — <code>cn()</code>
                  </li>
                  <li>
                    <code className="font-mono text-foreground">ui/desk.tsx</code> — MetaLink / MetaButton
                    (POC)
                  </li>
                </ul>
              </KitBlock>
            </Category>
        </DeskPage>
      </TooltipProvider>
    </Toaster>
  );
}
