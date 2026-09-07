import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Bell, BookOpen, Building2,
  CalendarDays, Camera, Check, ChevronDown, ChevronRight, ClipboardList, Clock3,
  Eye, FileCheck2, FilePlus2, Filter, Fingerprint, History, Home, Info, KeyRound,
  LayoutDashboard, LifeBuoy, ListFilter, LockKeyhole, MapPin, Menu, MoreHorizontal,
  Phone, Plus, Printer, Search, Settings, Shield,
  SlidersHorizontal, UserCheck, UserCog, Users, X, XCircle, type LucideIcon,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import heroImage from '@assets/site-images/luanda-skyline.jpg';
import supportImage from '@assets/site-images/angola-community-workers.jpg';

type CaseStatus = 'Em falta' | 'Encontrada' | 'Não identificada' | 'Localizada' | 'Encerrada';
type CaseCategory = 'Desaparecida' | 'Encontrada' | 'Não identificada';
type Role = 'Administrador nacional' | 'Administrador provincial' | 'Agente de polícia autorizado' | 'Instituição parceira';

type PersonCase = {
  id: string; reference: string; category: CaseCategory; status: CaseStatus; name: string;
  age: number; birthDate: string; parents: string; idNumber: string; phone: string;
  province: string; municipality: string; location: string; date: string; time: string;
  clothing: string; photo: 'available' | 'pending' | 'none'; photo_file_id?: string;
  unit: string; officer: string;
  created: string; updated: string; visibility: 'Restrito' | 'Partilhado' | 'Público';
  timeline: { date: string; label: string; note: string; actor: string; tone?: string }[];
};

const roles: Role[] = ['Administrador nacional', 'Administrador provincial', 'Agente de polícia autorizado', 'Instituição parceira'];
const provinces: string[] = [];
const navItems: { href: string; label: string; icon: LucideIcon; group?: string }[] = [
  { href: '/', label: 'Página inicial', icon: Home },
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard, group: 'Operação' },
  { href: '/ocorrencias', label: 'Ocorrências', icon: ClipboardList },
  { href: '/pesquisa', label: 'Pesquisa cruzada', icon: Search },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/utilizadores', label: 'Utilizadores', icon: Users, group: 'Governação' },
  { href: '/instituicoes', label: 'Instituições', icon: Building2 },
  { href: '/auditoria', label: 'Auditoria', icon: History },
  { href: '/definicoes', label: 'Definições', icon: Settings, group: 'Sistema' },
  { href: '/ajuda', label: 'Ajuda operacional', icon: LifeBuoy },
];

const mockCases: PersonCase[] = [];

const statusTone: Record<CaseStatus, string> = {
  'Em falta': 'bg-[#fff0d6] text-[#8b5a12] border-[#efd49b]',
  'Encontrada': 'bg-[#e1f1e9] text-[#246047] border-[#bddbc9]',
  'Não identificada': 'bg-[#f2e8ee] text-[#7d435d] border-[#e1c9d4]',
  'Localizada': 'bg-[#deedf2] text-[#225c6d] border-[#bad6df]',
  'Encerrada': 'bg-[#e9eceb] text-[#536260] border-[#d3d9d7]',
};

function cn(...classes: (string | false | undefined)[]) { return classes.filter(Boolean).join(' '); }
function formatRole(role: Role) { return role === 'Agente de polícia autorizado' ? 'Agente autorizado' : role; }

function CaseAvatar({ item, size = 'md' }: { item: PersonCase; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = { sm: 'h-9 w-9 text-[10px]', md: 'h-10 w-10 text-[11px]', lg: 'h-12 w-12 text-sm', xl: 'h-32 w-32 text-lg' };
  const initials = item.name.split(' ').map((n) => n[0]).slice(0, 2).join('');
  
  if (item.photo === 'available' && item.photo_file_id) {
    return (
      <img
        src={`/api/photos/${item.photo_file_id}?raw=1`}
        alt={item.name}
        className={`${sizeClasses[size]} shrink-0 object-cover ${size === 'xl' ? 'rounded-xl' : 'rounded-full'}`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  
  return (
    <span className={`grid ${sizeClasses[size]} shrink-0 place-items-center font-bold ${size === 'xl' ? 'rounded-xl' : 'rounded-full'} ${
      item.photo === 'available' ? 'bg-[#dbe9e5] text-[#245c68]' :
      item.photo === 'pending' ? 'bg-[#f1e3d6] text-[#94602a]' :
      'bg-[#deebe7] text-[#28616a]'
    }`}>
      {initials}
    </span>
  );
}

function AppContent() {
  const [cases, setCases] = useState<PersonCase[]>([]);
  const [stats, setStats] = useState({ municipalities: 0, totalCases: 0, locatedThisMonth: 0 });
  const [role, setRole] = useState<Role>('Administrador provincial');
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [provinceList, setProvinceList] = useState<string[]>([]);
  const isLogin = location === '/login';
  const isPublicHome = location === '/' || location === '/inicio';

  useEffect(() => {
    fetch('/api/provinces').then(r => r.json()).then((rows: any[]) => {
      setProvinceList(rows.map((r) => r.name));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/cases')
      .then(r => r.json())
      .then((rows: any[]) => {
        const mapped: PersonCase[] = rows.map((r) => ({
          id: String(r.id), reference: r.reference, category: r.category, status: r.status,
          name: r.name, age: r.age || 0, birthDate: r.birth_date || '', parents: r.parents || '',
          idNumber: r.id_number || '', phone: r.phone || '', province: r.province_name || '',
          municipality: r.municipality_name || '', location: r.location || '', date: r.date || '', time: r.time || '',
          clothing: r.clothing || '', photo: r.photo_file_id ? 'available' as const : 'none' as const,
          photo_file_id: r.photo_file_id || undefined, unit: '', officer: r.officer_name || '',
          created: r.created_at, updated: r.updated_at, visibility: r.visibility || 'Restrito',
          timeline: [],
        }));
        if (mapped.length >= 0) setCases(mapped);
      })
      .catch(() => {});
  }, []);

  const addDraft = async (data: Partial<PersonCase>) => {
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name, category: data.category, location: data.location,
          clothing: data.clothing, province: data.province, municipality: data.municipality,
          photo_file_id: data.photo_file_id, photo_message_id: (data as any).photo_message_id,
          visibility: data.visibility || 'Restrito', status: data.category === 'Encontrada' ? 'Localizada' : 'Em falta',
          date: data.date, time: data.time,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        const c = result.case;
        const draft: PersonCase = {
          ...data as any, id: String(c.id), reference: c.reference,
          status: data.category === 'Encontrada' ? 'Localizada' : 'Em falta', category: data.category || 'Desaparecida', name: data.name || 'Pessoa sem nome',
          created: c.created_at, updated: c.updated_at, age: 0, birthDate: '', parents: '', idNumber: '', phone: '',
          province: data.province || '', municipality: data.municipality || '', location: data.location || '',
          date: '', time: '', clothing: data.clothing || '', photo: data.photo_file_id ? 'available' as const : 'none' as const,
          photo_file_id: data.photo_file_id, unit: '', officer: '',
          visibility: data.visibility || 'Restrito' as const,
          timeline: [{ date: 'Agora', label: 'Rascunho criado', note: 'A ocorrência foi registada na base de dados.', actor: 'Sistema Localiza' }],
        };
        setCases((current) => [draft, ...current]);
        setLocation(`/ocorrencias/${c.id}`);
        return;
      }
    } catch {}
    const id = String(Date.now());
    const draft: PersonCase = {
      id, reference: `LZA-2025-${String(500 + cases.length).padStart(5, '0')}`,
      status: data.category === 'Encontrada' ? 'Localizada' : 'Em falta', category: data.category || 'Desaparecida', name: data.name || 'Pessoa sem nome',
      created: 'Agora', updated: 'Agora', age: 0, birthDate: '', parents: '', idNumber: '', phone: '',
      province: data.province || '', municipality: data.municipality || '', location: data.location || '',
      date: '', time: '', clothing: data.clothing || '', photo: data.photo_file_id ? 'available' as const : 'none' as const,
      photo_file_id: data.photo_file_id, unit: '', officer: '',
      visibility: (data.visibility || 'Restrito') as any,
      timeline: [{ date: 'Agora', label: 'Rascunho criado', note: 'A ocorrência foi guardada localmente.', actor: 'Sessão de demonstração' }],
    };
    setCases((current) => [draft, ...current]);
    setLocation(`/ocorrencias/${id}`);
  };

  const deleteCase = async (id: string) => {
    try {
      await fetch(`/api/cases/${id}`, { method: 'DELETE' });
    } catch {}
    setCases((current) => current.filter((c) => c.id !== id));
  };
  if (isLogin) return <div className="relative"><Login onEnter={(user) => { setRole(user.role as Role); setLocation('/dashboard'); }} /><Link href="/" data-testid="link-login-back-home" className="fixed right-5 top-5 z-50 inline-flex items-center gap-2 rounded-lg bg-[#173e4d] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#214f5e]"><ArrowLeft size={14} />Voltar à página inicial</Link></div>;
  if (isPublicHome) return <PublicHome cases={cases} />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="app-noise min-h-[100dvh] bg-[#f4f1ea]">
          <Shell role={role} setRole={setRole} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} notificationsOn={notificationsOn} setNotificationsOn={setNotificationsOn} />
          <main className="min-h-[100dvh] md:pl-[246px]">
            <div className="mx-auto max-w-[1560px] px-4 pb-12 pt-4 sm:px-6 lg:px-10">
              <Switch>
                <Route path="/dashboard" component={() => <Dashboard cases={cases} />} />
                <Route path="/ocorrencias" component={() => <CasesPage cases={cases} onDelete={deleteCase} provinces={provinceList} />} />
                <Route path="/ocorrencias/nova" component={() => <NewCase onSave={addDraft} provinces={provinceList} />} />
                <Route path="/ocorrencias/:id" component={() => <CaseDetail cases={cases} />} />
                <Route path="/pesquisa" component={() => <SearchPage cases={cases} />} />
                <Route path="/utilizadores" component={() => <UsersPage />} />
                <Route path="/instituicoes" component={() => <InstitutionsPage />} />
                <Route path="/auditoria" component={() => <AuditPage />} />
                <Route path="/notificacoes" component={() => <NotificationsPage />} />
                <Route path="/definicoes" component={() => <SettingsPage notificationsOn={notificationsOn} setNotificationsOn={setNotificationsOn} />} />
                <Route path="/ajuda" component={() => <HelpPage />} />
                <Route component={() => <NotFoundPage />} />
              </Switch>
            </div>
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const queryClient = new QueryClient();

function Shell({ role, setRole, sidebarOpen, setSidebarOpen, notificationsOn, setNotificationsOn }: { role: Role; setRole: (r: Role) => void; sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void; notificationsOn: boolean; setNotificationsOn: (v: boolean) => void }) {
  const [location] = useLocation();
  const [roleOpen, setRoleOpen] = useState(false);
  const current = navItems.find((item) => location === item.href)?.label || (location.startsWith('/ocorrencias/') ? 'Detalhe da ocorrência' : 'Visão geral');
  return (
    <>
      <div className={cn('fixed inset-0 z-30 bg-[#102e3a]/35 md:hidden', !sidebarOpen && 'hidden')} onClick={() => setSidebarOpen(false)} />
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col bg-[#173e4d] text-[#eaf0eb] transition-transform duration-200 md:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9aa4b] text-[#173e4d]"><Fingerprint size={21} strokeWidth={2.3} /></div>
          <div><div className="font-display text-[17px] font-bold tracking-tight">LOCALIZA</div><div className="font-mono text-[9px] tracking-[.18em] text-[#a9c1bf]">ANGOLA · REDE SEGURA</div></div>
          <button data-testid="button-close-sidebar" onClick={() => setSidebarOpen(false)} className="ml-auto text-[#a9c1bf] md:hidden"><X size={18} /></button>
        </div>
        <div className="px-4 py-5">
          <div className="mb-3 px-2 font-mono text-[9px] uppercase tracking-[.17em] text-[#83a7aa]">Navegação principal</div>
          <nav className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = location === item.href || (item.href === '/ocorrencias' && location.startsWith('/ocorrencias'));
              return <div key={item.href}>
                {item.group && (index !== 0) && <div className="mb-3 mt-6 px-2 font-mono text-[9px] uppercase tracking-[.17em] text-[#83a7aa]">{item.group}</div>}
                <Link data-testid={`link-nav-${item.label}`} href={item.href} onClick={() => setSidebarOpen(false)} className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors', active ? 'bg-[#e9aa4b] font-semibold text-[#173e4d]' : 'text-[#c9d8d4] hover:bg-white/10 hover:text-white')}>
                  <Icon size={17} strokeWidth={active ? 2.5 : 1.8} /><span>{item.label}</span>
                  {item.href === '/notificacoes' && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[#c66b4e] px-1 text-[10px] font-bold text-white">3</span>}
                </Link>
              </div>;
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2"><Shield size={15} className="text-[#e9aa4b]" /><span className="font-mono text-[9px] uppercase tracking-wider text-[#a9c1bf]">Acesso protegido</span></div>
            <p className="text-[11px] leading-relaxed text-[#c9d8d4]">Os dados desta rede são confidenciais. Registe cada consulta e partilha.</p>
          </div>
          <Link data-testid="link-help-sidebar" href="/ajuda" className="mt-4 flex items-center gap-2 px-2 text-[12px] text-[#a9c1bf] hover:text-white"><LifeBuoy size={15} /> Centro de ajuda</Link>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#dedbd2] bg-[#f4f1ea]/90 px-4 backdrop-blur-md md:ml-[246px] md:px-8">
        <div className="flex items-center gap-3"><button data-testid="button-open-sidebar" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-[#365662] hover:bg-[#e9e4d9] md:hidden"><Menu size={20} /></button><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8a908c]">Localiza Angola / {current}</div><div className="mt-1 text-sm font-semibold text-[#214554]">Quarta-feira, 18 de Junho de 2025</div></div></div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button data-testid="button-header-notifications" onClick={() => setNotificationsOn(!notificationsOn)} className="relative rounded-lg p-2 text-[#55717a] transition-colors hover:bg-[#e9e4d9]"><Bell size={19} />{notificationsOn && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#c66b4e]" />}</button>
          <div className="relative">
            <button data-testid="button-role-switcher" onClick={() => setRoleOpen(!roleOpen)} className="flex items-center gap-2 rounded-xl border border-[#d9d6ce] bg-[#fbfaf6] px-2 py-1.5 text-left hover:border-[#b8b9ae] sm:px-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#dbe9e5] text-xs font-bold text-[#245669]">AM</span><span className="hidden sm:block"><span className="block text-[12px] font-semibold text-[#214554]">Ana Martins</span><span className="block text-[10px] text-[#77837f]">{formatRole(role)}</span></span><ChevronDown size={14} className="text-[#77837f]" /></button>
            {roleOpen && <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-2 shadow-xl"><div className="border-b border-[#ebe7de] px-3 pb-2 pt-1"><p className="font-mono text-[9px] uppercase tracking-wider text-[#8a908c]">Mudar vista de demonstração</p></div>{roles.map((r) => <button data-testid={`button-role-${r}`} key={r} onClick={() => { setRole(r); setRoleOpen(false); }} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f0ede5]', role === r && 'bg-[#e9f0ec] font-semibold text-[#1f5b54]')}>{r}{role === r && <Check size={14} />}</button>)}</div>}
          </div>
        </div>
      </header>
    </>
  );
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-7 pt-5"><BackButton /><div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#ae7430]">{eyebrow}</div><h1 className="font-display text-3xl font-bold tracking-[-.03em] text-[#214554] sm:text-[38px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm text-[#667570]">{description}</p>}</div>{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}</div></div>;
}

function BackButton() {
  const [, setLocation] = useLocation();
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation('/');
    }
  };
  return <button type="button" data-testid="button-back-page" onClick={goBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#6a7d78] transition-colors hover:bg-[#e8e5dc] hover:text-[#214554]"><ArrowLeft size={15} />Voltar</button>;
}

function Button({ children, variant = 'primary', onClick, icon: Icon, testId, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; onClick?: () => void; icon?: LucideIcon; testId?: string; type?: 'button' | 'submit' }) {
  return <button type={type} data-testid={testId} onClick={onClick} className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold transition-all active:scale-[.98]', variant === 'primary' && 'bg-[#1e5668] text-white shadow-sm hover:bg-[#174858]', variant === 'secondary' && 'border border-[#ccd0c7] bg-[#fbfaf6] text-[#2a5965] hover:border-[#94aaa5] hover:bg-[#f0ede5]', variant === 'quiet' && 'text-[#5d777b] hover:bg-[#e8e5dc] hover:text-[#214554]', variant === 'danger' && 'border border-[#e4bbb0] bg-[#fff5f1] text-[#a34f3e] hover:bg-[#fae7e0]')}>{Icon && <Icon size={15} />}{children}</button>;
}

function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none', tone || 'border-[#d5ddd8] bg-[#edf2ee] text-[#42645d]')}>{children}</span>;
}

function StatCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone: 'amber' | 'teal' | 'rose' | 'blue' }) {
  const tones = { amber: 'bg-[#f8e8c9] text-[#8b5a12]', teal: 'bg-[#d9ece7] text-[#246258]', rose: 'bg-[#f1dfdb] text-[#9a5044]', blue: 'bg-[#dcebf0] text-[#225b6c]' };
  return <div className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-4 shadow-[var(--shadow-sm)] transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-medium text-[#71807b]">{label}</p><p className="mt-2 font-display text-[30px] font-bold tracking-[-.04em] text-[#214554]">{value}</p></div><span className={cn('grid h-9 w-9 place-items-center rounded-lg', tones[tone])}><Icon size={17} /></span></div><div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#7a8781]"><span className="h-1.5 w-1.5 rounded-full bg-[#74a98f]" />{detail}</div></div>;
}

function PublicHome({ cases }: { cases: PersonCase[] }) {
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('Todas as províncias');
  const [showAll, setShowAll] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ src: string; name: string } | null>(null);
  const curatedCases = cases.filter((item) => item.status !== 'Encerrada');
  const filteredCases = curatedCases.filter((item) => {
    const matchesQuery = !query.trim() || `${item.name} ${item.reference} ${item.location} ${item.municipality}`.toLowerCase().includes(query.toLowerCase());
    const matchesProvince = province === 'Todas as províncias' || item.province === province;
    return matchesQuery && matchesProvince;
  });
  const visibleCases = showAll ? filteredCases : filteredCases.slice(0, 3);

  return (
    <div className="app-noise min-h-[100dvh] bg-[#f4f1ea] text-[#214554]">
      <header className="border-b border-[#dfe0d8] bg-[#f8f6f0]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" data-testid="link-public-logo">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9aa4b] text-[#173e4d]"><Fingerprint size={21} /></span>
            <span><span className="block font-display text-[17px] font-bold tracking-tight">LOCALIZA</span><span className="block font-mono text-[9px] tracking-[.18em] text-[#7b8982]">ANGOLA · REDE SEGURA</span></span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5">
            <a href="#casos" className="hidden text-[12px] font-semibold text-[#537077] hover:text-[#214554] sm:inline">Pessoas desaparecidas</a>
            <a href="#como-ajudar" className="hidden text-[12px] font-semibold text-[#537077] hover:text-[#214554] sm:inline">Como ajudar</a>
            <Link href="/login" data-testid="link-public-login" className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-3.5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#174858]"><LockKeyhole size={14} />Acesso institucional</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-[1.06fr_.94fr] lg:items-center lg:gap-20 lg:pb-20 lg:pt-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d5ddd8] bg-[#edf3ee] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-[#3f716b]"><Shield size={13} />Informação pública autorizada</div>
            <h1 className="max-w-3xl font-display text-[38px] font-bold leading-[1.08] tracking-[-.04em] text-[#214554] sm:text-5xl">Cada pessoa<br /><span className="text-[#ae7430]">de volta a casa.</span></h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#61736f]">Consulte informações públicas sobre pessoas desaparecidas em Angola. Se reconhecer alguém, partilhe esta informação com uma unidade policial ou instituição autorizada.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#casos" data-testid="link-public-see-cases" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e5668] px-4 py-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#174858]">Ver pessoas desaparecidas <ArrowRight size={15} /></a>
              <a href="#como-ajudar" data-testid="link-public-how-to-help" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ccd0c7] bg-[#fbfaf6] px-4 py-3 text-[12px] font-semibold text-[#2a5965] transition-colors hover:border-[#94aaa5] hover:bg-[#f0ede5]"><Info size={15} />Como comunicar</a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#778680]"><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#4b8b76]" />Dados sensíveis protegidos</span><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#4b8b76]" />Atualização pelas autoridades</span></div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[#c9d5cf] bg-[#173e4d] shadow-[0_14px_35px_rgba(33,69,84,.12)]">
            <img src={heroImage} alt="Vista da Baía e do skyline de Luanda, Angola." className="h-[390px] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#173e4d]/90 via-[#173e4d]/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-[#f8f6f0] sm:p-8">
              <p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#f0c574]">Rede nacional</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div><p className="font-display text-3xl font-bold">{stats.totalCases}</p><p className="mt-1 text-[11px] text-[#d5e2db]">casos com informação pública</p></div>
                <div className="text-right"><p className="font-display text-3xl font-bold text-[#f0c574]">{stats.locatedThisMonth}</p><p className="mt-1 text-[11px] text-[#d5e2db]">pessoas localizadas este mês</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="casos" className="border-y border-[#dedbd2] bg-[#fbfaf6]">
          <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 lg:py-16">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#ae7430]">Casos em destaque</p><h2 className="font-display text-3xl font-bold tracking-[-.04em] text-[#214554] sm:text-4xl">Pessoas desaparecidas</h2><p className="mt-2 max-w-xl text-sm text-[#71807b]">Procure pelo nome, referência ou local da última informação conhecida.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#fff0d6] px-3 py-1.5 text-[10px] font-semibold text-[#8b5a12]"><span className="h-1.5 w-1.5 rounded-full bg-[#c98d37]" />Atualizado hoje</span></div>
            <div className="mt-8 flex flex-col gap-3 rounded-xl border border-[#dedbd2] bg-[#f4f1ea] p-3 sm:flex-row">
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#d5d8cf] bg-[#fbfaf6] px-3 text-[#83908a]"><Search size={16} /><input data-testid="input-public-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, referência ou local" className="h-10 w-full bg-transparent text-xs text-[#214554] outline-none placeholder:text-[#98a29b]" /></label>
              <select data-testid="select-public-province" value={province} onChange={(event) => setProvince(event.target.value)} className="h-10 rounded-lg border border-[#d5d8cf] bg-[#fbfaf6] px-3 text-xs text-[#526c70] outline-none"><option>Todas as províncias</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select>
            </div>
            {visibleCases.length > 0 ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visibleCases.map((item) => <article key={item.id} className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 transition-all hover:-translate-y-0.5 hover:border-[#b8cbc2] hover:shadow-[var(--shadow-md)]" data-testid={`card-public-case-${item.id}`}><div className="flex gap-4"><div className="cursor-pointer" onClick={() => { if (item.photo_file_id) setPhotoModal({ src: `/api/photos/${item.photo_file_id}?raw=1`, name: item.name }); }}><CaseAvatar item={item} size="xl" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-display text-lg font-bold text-[#214554]">{item.name}</h3><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.status === 'Localizada' ? 'border-[#bad6df] bg-[#deedf2] text-[#225c6d]' : 'border-[#efd49b] bg-[#fff0d6] text-[#8b5a12]'}`}>{item.status === 'Localizada' ? 'Encontrado' : 'Desaparecido'}</span></div><p className="mt-1 font-mono text-[10px] tracking-wide text-[#8a9690]">{item.reference} · {item.age} anos</p><div className="mt-4 space-y-2 border-t border-[#ebe7de] pt-3 text-[11px] text-[#64756f]"><p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-[#ae7430]" /><span>{item.location}, {item.municipality} · {item.province}</span></p><p className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0 text-[#ae7430]" /><span>Última informação: {item.date}</span></p><p className="flex items-start gap-2"><Info size={14} className="mt-0.5 shrink-0 text-[#ae7430]" /><span>{item.clothing}</span></p></div><button type="button" data-testid={`button-public-case-${item.id}`} onClick={() => document.getElementById('como-ajudar')?.scrollIntoView({ behavior: 'smooth' })} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2d6970] hover:text-[#ae7430]">Como ajudar neste caso <ChevronRight size={14} /></button></div></div></article>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-[#cbd2cc] bg-[#f8f6f0] p-12 text-center"><Search size={22} className="mx-auto text-[#8a9991]" /><p className="mt-3 text-sm font-semibold text-[#526c70]">Nenhum caso encontrado</p><p className="mt-1 text-xs text-[#87938d]">Experimente pesquisar por outro nome ou província.</p></div>}
            {filteredCases.length > 3 && !showAll ? <button type="button" data-testid="button-public-see-all" onClick={() => setShowAll(true)} className="mx-auto mt-8 flex items-center gap-2 text-[12px] font-semibold text-[#2d6970] hover:text-[#ae7430]">Ver todos os casos publicados <ArrowRight size={15} /></button> : null}
          </div>
        </section>

        <section id="como-ajudar" className="mx-auto grid max-w-[1240px] gap-6 px-5 py-14 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
          <div className="rounded-2xl bg-[#e6eee8] p-7 sm:p-9"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#47756e]">Se reconhece alguém?</p><h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-[-.04em] text-[#214554]">Uma informação pode fazer a diferença.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[#637871]">Não tente abordar ou deslocar a pessoa sozinho. Registe a referência do caso e comunique a informação à unidade policial mais próxima ou aos serviços de emergência locais.</p><div className="mt-6 flex flex-wrap gap-3"><a href="#casos" className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-4 py-3 text-[12px] font-semibold text-white hover:bg-[#174858]">Voltar aos casos <ArrowLeft size={15} /></a><Link href="/login" data-testid="link-help-institutional" className="inline-flex items-center gap-2 rounded-lg border border-[#b9cbc1] text-[#2a5965] px-4 py-3 text-[12px] font-semibold hover:bg-white/50"><LockKeyhole size={14} />Acesso institucional</Link></div></div>
          <div className="overflow-hidden rounded-2xl border border-[#dedbd2] bg-[#fbfaf6]"><img src={supportImage} alt="Equipa comunitária em Angola, imagem ilustrativa." className="h-44 w-full object-cover" /><div className="p-7 sm:p-9"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8e8c9] text-[#8b5a12]"><Phone size={18} /></div><h3 className="mt-5 font-display text-xl font-bold text-[#214554]">Precisa de comunicar um desaparecimento?</h3><p className="mt-3 text-sm leading-6 text-[#71807b]">Dirija-se à unidade policial mais próxima com uma fotografia recente e o máximo de informação disponível.</p><div className="mt-6 border-t border-[#ebe7de] pt-5 text-[11px] leading-relaxed text-[#798780]"><span className="font-semibold text-[#526c70]">Importante:</span> a plataforma não substitui a participação formal às autoridades competentes.</div></div></div>
        </section>
      </main>

      <footer className="border-t border-[#dedbd2] bg-[#173e4d] text-[#d7e4de]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8"><div><p className="font-display text-sm font-bold">LOCALIZA ANGOLA</p><p className="mt-1 text-[10px] text-[#a9c1bf]">Rede segura para localização e reunificação familiar</p></div><div className="flex items-center gap-2 text-[10px] text-[#a9c1bf]"><Shield size={13} className="text-[#e9aa4b]" /> Informação pública com proteção de dados</div></div>
      </footer>
      {photoModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-5" onClick={() => setPhotoModal(null)}><div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}><button onClick={() => setPhotoModal(null)} className="absolute -right-3 -top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-[#333] shadow-lg hover:bg-[#eee]"><X size={18} /></button><img src={photoModal.src} alt={photoModal.name} className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" /><p className="mt-3 text-center text-sm font-semibold text-white">{photoModal.name}</p></div></div>}
    </div>
  );
}

function Dashboard({ cases }: { cases: PersonCase[] }) {
  const urgent = cases.filter((c) => c.status === 'Em falta' || c.status === 'Não identificada');
  const activeCount = cases.filter((c) => c.status !== 'Encerrada').length;
  const missingCount = cases.filter((c) => c.status === 'Em falta').length;
  const locatedCount = cases.filter((c) => c.status === 'Localizada').length;
  const unknownCount = cases.filter((c) => c.status === 'Não identificada').length;
  return <div className="fade-up"><PageHeader eyebrow="Centro de comando" title="Bom dia." description="Acompanhe o estado da rede e mantenha cada caso em movimento." actions={<><Link data-testid="link-dashboard-search" href="/pesquisa" className="inline-flex items-center gap-2 rounded-lg border border-[#ccd0c7] bg-[#fbfaf6] px-3.5 py-2.5 text-[12px] font-semibold text-[#2a5965] hover:border-[#94aaa5] hover:bg-[#f0ede5]"><Search size={15} />Pesquisa cruzada</Link><Link data-testid="link-new-case-dashboard" href="/ocorrencias/nova" className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-3.5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174858]"><Plus size={15} />Nova ocorrência</Link></>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Casos activos" value={String(activeCount)} detail={`${activeCount} no total`} icon={Activity} tone="amber" />
      <StatCard label="Em falta" value={String(missingCount)} detail={`${missingCount} requerem atenção`} icon={AlertTriangle} tone="rose" />
      <StatCard label="Localizadas" value={String(locatedCount)} detail={`${locatedCount} com família reunida`} icon={UserCheck} tone="teal" />
      <StatCard label="Por identificar" value={String(unknownCount)} detail={`${unknownCount} novos`} icon={Fingerprint} tone="blue" />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
      <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between border-b border-[#ebe7de] px-5 py-4"><div><h2 className="font-display text-lg font-bold text-[#214554]">Atenção prioritária</h2><p className="mt-0.5 text-xs text-[#77837f]">Casos que precisam de uma próxima acção</p></div><Link data-testid="link-priority-cases" href="/ocorrencias" className="text-[11px] font-semibold text-[#ae7430] hover:underline">Ver todas <ArrowRight className="ml-1 inline" size={13} /></Link></div><div className="divide-y divide-[#eeeae2]">{urgent.slice(0, 3).map((item) => <Link data-testid={`link-priority-${item.id}`} href={`/ocorrencias/${item.id}`} key={item.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#f6f3eb]"><CaseAvatar item={item} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[13px] font-semibold text-[#2d505b]">{item.name}</span><Badge tone={statusTone[item.status]}>{item.status}</Badge></div><div className="mt-1 flex gap-3 font-mono text-[9px] text-[#87918b]"><span>{item.reference}</span><span>{item.province} · {item.municipality}</span></div></div><div className="hidden text-right sm:block"><p className="text-[10px] font-semibold text-[#556f73]">{item.updated}</p><p className="mt-1 text-[10px] text-[#98a09a]">última actualização</p></div><ChevronRight size={16} className="text-[#abb4ac]" /></Link>)}</div></section>
      <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><div className="border-b border-[#ebe7de] px-5 py-4"><h2 className="font-display text-lg font-bold text-[#214554]">Actividade recente</h2><p className="mt-0.5 text-xs text-[#77837f]">Últimas acções na sua vista</p></div><div className="space-y-5 px-5 py-5">{[{ icon: FileCheck2, title: 'Ocorrência actualizada', note: 'LZA-2025-00481 · localização revista', time: '08:42', color: 'text-[#ae7430]' }, { icon: UserCheck, title: 'Pessoa localizada', note: 'LZA-2025-00438 · Viana', time: 'Ontem', color: 'text-[#347768]' }, { icon: Search, title: 'Pesquisa executada', note: 'Critérios: nome + Luanda', time: 'Ontem', color: 'text-[#477d91]' }, { icon: Shield, title: 'Acesso registado', note: 'Consulta de ocorrência restrita', time: '17 Jun', color: 'text-[#7b6878]' }].map((event) => <div className="flex gap-3" key={event.title}><div className={cn('mt-0.5', event.color)}><event.icon size={16} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#385761]">{event.title}</p><p className="mt-0.5 truncate text-[11px] text-[#7d8983]">{event.note}</p></div><span className="font-mono text-[9px] text-[#9ca49e]">{event.time}</span></div>)}</div><div className="mx-5 mb-5 rounded-lg bg-[#f1eee6] px-3 py-2.5 text-[10px] leading-relaxed text-[#697872]"><Info size={13} className="mr-1 inline text-[#ae7430]" /> A sua vista mostra apenas informação autorizada pelo nível de acesso actual.</div></section>
    </div>
    <section className="mt-5 grid gap-3 sm:grid-cols-3"><QuickAction href="/ocorrencias/nova" icon={FilePlus2} title="Registar ocorrência" note="Nova pessoa em falta ou encontrada" /><QuickAction href="/pesquisa" icon={SlidersHorizontal} title="Encontrar correspondências" note="Pesquisar em todos os registos autorizados" /><QuickAction href="/notificacoes" icon={Bell} title="Rever notificações" note="3 itens aguardam acompanhamento" /></section>
  </div>;
}

function QuickAction({ href, icon: Icon, title, note }: { href: string; icon: LucideIcon; title: string; note: string }) { return <Link data-testid={`link-quick-${title}`} href={href} className="group flex items-center gap-3 rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[#b9c8c0]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e6efeb] text-[#2c6a67] group-hover:bg-[#d6e8e0]"><Icon size={17} /></span><span><span className="block text-[13px] font-semibold text-[#315963]">{title}</span><span className="mt-0.5 block text-[11px] text-[#818b85]">{note}</span></span><ArrowRight size={15} className="ml-auto text-[#a7b0a8] transition-transform group-hover:translate-x-1" /></Link>; }

function CasesPage({ cases, onDelete, provinces: provList }: { cases: PersonCase[]; onDelete?: (id: string) => void; provinces?: string[] }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('Todos'); const [category, setCategory] = useState('Todas'); const [province, setProvince] = useState('Todas'); const [view, setView] = useState<'list' | 'cards'>('list');
  const filtered = useMemo(() => cases.filter((c) => (!query || `${c.name} ${c.reference} ${c.idNumber}`.toLowerCase().includes(query.toLowerCase())) && (status === 'Todos' || c.status === status) && (category === 'Todas' || c.category === category) && (province === 'Todas' || c.province === province)), [cases, query, status, category, province]);
  return <div className="fade-up"><PageHeader eyebrow="Registo operacional" title="Ocorrências" description="Pesquise e acompanhe casos sob a sua autorização de acesso." actions={<Link data-testid="link-new-case" href="/ocorrencias/nova" className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-3.5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174858]"><Plus size={15} />Nova ocorrência</Link>} />
    <div className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><div className="flex flex-col gap-3 border-b border-[#ebe7de] p-4 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3 text-[#8d9991]" /><input data-testid="input-search-cases" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, referência ou número de identificação" className="h-10 w-full rounded-lg border border-[#d6d8d0] bg-[#fdfcf8] pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-[#9ba39d] focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div><select data-testid="select-status-cases" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#d6d8d0] bg-[#fdfcf8] px-3 text-xs text-[#4f666a] outline-none"><option>Todos</option>{['Em falta', 'Encontrada', 'Não identificada', 'Localizada', 'Encerrada'].map((x) => <option key={x}>{x}</option>)}</select><select data-testid="select-category-cases" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-[#d6d8d0] bg-[#fdfcf8] px-3 text-xs text-[#4f666a] outline-none"><option>Todas</option>{['Desaparecida', 'Encontrada', 'Não identificada'].map((x) => <option key={x}>{x}</option>)}</select><select data-testid="select-province-cases" value={province} onChange={(e) => setProvince(e.target.value)} className="h-10 rounded-lg border border-[#d6d8d0] bg-[#fdfcf8] px-3 text-xs text-[#4f666a] outline-none"><option>Todas</option>{(provList || []).map((x) => <option key={x}>{x}</option>)}</select><div className="flex rounded-lg border border-[#d6d8d0] bg-[#f4f1ea] p-1"><button data-testid="button-list-view" onClick={() => setView('list')} className={cn('rounded px-2 py-1.5 text-[#688078]', view === 'list' && 'bg-[#fbfaf6] text-[#1e5668] shadow-sm')}><ListFilter size={15} /></button><button data-testid="button-card-view" onClick={() => setView('cards')} className={cn('rounded px-2 py-1.5 text-[#688078]', view === 'cards' && 'bg-[#fbfaf6] text-[#1e5668] shadow-sm')}><SlidersHorizontal size={15} /></button></div></div><div className="flex items-center justify-between px-5 py-3"><span className="font-mono text-[10px] text-[#88928c]">{filtered.length} de {cases.length} ocorrências</span><button data-testid="button-clear-filters" onClick={() => { setQuery(''); setStatus('Todos'); setCategory('Todas'); setProvince('Todas'); }} className="text-[10px] font-semibold text-[#ae7430] hover:underline">Limpar filtros</button></div>
      {filtered.length === 0 ? <EmptyState icon={Search} title="Nenhuma ocorrência encontrada" note="Tente remover alguns filtros ou pesquisar por outro termo." action={<Button variant="secondary" onClick={() => { setQuery(''); setStatus('Todos'); setCategory('Todas'); setProvince('Todas'); }} testId="button-empty-clear">Limpar pesquisa</Button>} /> : view === 'list' ? <CaseTable cases={filtered} onDelete={onDelete} /> : <div className="grid gap-3 border-t border-[#ebe7de] p-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <CaseCard key={item.id} item={item} onDelete={onDelete} />)}</div>}
    </div>
  </div>;
}

function CaseTable({ cases, onDelete }: { cases: PersonCase[]; onDelete?: (id: string) => void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[790px] text-left"><thead><tr className="border-y border-[#ebe7de] bg-[#f7f4ee] font-mono text-[9px] uppercase tracking-wider text-[#89948d]"><th className="px-5 py-3 font-normal">Pessoa / referência</th><th className="px-3 py-3 font-normal">Estado</th><th className="px-3 py-3 font-normal">Local</th><th className="px-3 py-3 font-normal">Responsável</th><th className="px-3 py-3 font-normal">Actualizado</th><th className="px-3 py-3" /></tr></thead><tbody className="divide-y divide-[#eeeae2]">{cases.map((item) => <tr data-testid={`row-case-${item.id}`} key={item.id} className="group transition-colors hover:bg-[#f8f6f0]"><td className="px-5 py-3.5"><Link data-testid={`link-case-${item.id}`} href={`/ocorrencias/${item.id}`} className="flex items-center gap-3"><CaseAvatar item={item} size="sm" /><span><span className="block text-[12px] font-semibold text-[#2b535e] group-hover:text-[#ae7430]">{item.name}</span><span className="mt-0.5 block font-mono text-[9px] text-[#909a92]">{item.reference}</span></span></Link></td><td className="px-3 py-3.5"><Badge tone={statusTone[item.status]}>{item.status}</Badge></td><td className="px-3 py-3.5"><span className="block text-[11px] text-[#506b70]">{item.province}</span><span className="block text-[10px] text-[#929b95]">{item.municipality}</span></td><td className="px-3 py-3.5 text-[11px] text-[#5e7476]">{item.officer}</td><td className="px-3 py-3.5 font-mono text-[9px] text-[#8c9790]">{item.updated}</td><td className="px-3 py-3.5 flex gap-1"><Link data-testid={`link-view-case-${item.id}`} href={`/ocorrencias/${item.id}`} className="rounded p-1.5 text-[#84948d] hover:bg-[#e9efeb] hover:text-[#2b6470]"><Eye size={16} /></Link>{onDelete && <button data-testid={`button-delete-case-${item.id}`} onClick={(e) => { e.preventDefault(); if (confirm('Tem certeza que deseja apagar esta ocorrência?')) onDelete(item.id); }} className="rounded p-1.5 text-[#a0918a] hover:bg-[#fde8e8] hover:text-[#b33]"><XCircle size={16} /></button>}</td></tr>)}</tbody></table></div>; }
function CaseCard({ item, onDelete }: { item: PersonCase; onDelete?: (id: string) => void }) { return <div className="relative rounded-xl border border-[#e1ded5] bg-[#fdfcf8] p-4 transition-all hover:-translate-y-0.5 hover:border-[#aabfba] hover:shadow-md">{onDelete && <button data-testid={`button-delete-case-card-${item.id}`} onClick={(e) => { e.preventDefault(); if (confirm('Tem certeza que deseja apagar esta ocorrência?')) onDelete(item.id); }} className="absolute right-3 top-3 rounded p-1 text-[#a0918a] hover:bg-[#fde8e8] hover:text-[#b33]"><XCircle size={14} /></button>}<Link data-testid={`card-case-${item.id}`} href={`/ocorrencias/${item.id}`} className="block"><div className="flex items-start justify-between"><CaseAvatar item={item} /><Badge tone={statusTone[item.status]}>{item.status}</Badge></div><h3 className="mt-4 text-sm font-semibold text-[#2b535e]">{item.name}</h3><p className="mt-1 font-mono text-[9px] text-[#909a92]">{item.reference}</p><div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#eeeae2] pt-3 text-[10px] text-[#6f7f78]"><span><MapPin size={12} className="mr-1 inline" />{item.province}</span><span><Clock3 size={12} className="mr-1 inline" />{item.updated}</span></div></Link></div>; }

function NewCase({ onSave, provinces }: { onSave: (data: Partial<PersonCase>) => void; provinces: string[] }) {
  const [kind, setKind] = useState<'missing' | 'found'>('missing');
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [municipalityList, setMunicipalityList] = useState<string[]>([]);
  const [idNumber, setIdNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [parents, setParents] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [clothing, setClothing] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const dateInputRef = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!province) { setMunicipalityList([]); setMunicipality(''); return; }
    fetch('/api/provinces').then(r => r.json()).then((rows: any[]) => {
      const prov = rows.find((r: any) => r.name === province);
      if (prov) {
        fetch(`/api/municipalities/${prov.id}`).then(r => r.json()).then((muns: any[]) => {
          setMunicipalityList(muns.map((m: any) => m.name));
        }).catch(() => setMunicipalityList([]));
      }
    }).catch(() => {});
  }, [province]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A fotografia deve ter no máximo 5 MB.');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadPhotoToTelegram = async (caseRef: string): Promise<string | null> => {
    if (!photoFile) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      formData.append('project', 'LZA');
      formData.append('reference', caseRef);
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) return data.file_id;
      return null;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!photoFile) { alert('A fotografia é obrigatória. Por favor, anexe uma imagem antes de submeter.'); return; }
    const ref = `LZA-2025-${String(500 + Math.floor(Math.random() * 1000)).padStart(5, '0')}`;
    const photoFileId = await uploadPhotoToTelegram(ref);
    onSave({
      name: name || 'Pessoa sem nome',
      province,
      municipality: municipality || 'Por confirmar',
      category: kind === 'missing' ? 'Desaparecida' : 'Encontrada',
      location: location || 'Por confirmar',
      clothing: clothing || 'A preencher',
      photo: photoFileId ? 'available' : 'none',
      photo_file_id: photoFileId || undefined,
      idNumber,
      birthDate,
      parents,
      phone,
      date: date || 'Por confirmar',
      time: time || 'Por confirmar',
      visibility: 'Restrito',
    });
    setSaved(true);
  };

  if (saved) return <div className="fade-up"><PageHeader eyebrow="Registo concluído" title="Ocorrência guardada" description="A ocorrência foi registada com sucesso na rede Localiza." actions={<Link href="/ocorrencias" className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-3.5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174858]"><ArrowLeft size={15} />Ver ocorrências</Link>} /></div>;

  return <div className="fade-up"><PageHeader eyebrow="Novo registo" title="Nova ocorrência" description="Registe apenas informação necessária, verificável e autorizada para este caso." actions={<Link data-testid="link-cancel-new-case" href="/ocorrencias" className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold text-[#5d777b] hover:bg-[#e8e5dc]"><ArrowLeft size={15} />Cancelar</Link>} /><div className="mx-auto max-w-[1050px]"><div className="mb-5 flex items-center gap-2 rounded-xl border border-[#d5e2dc] bg-[#eaf2ee] px-4 py-3 text-xs text-[#42665f]"><Shield size={16} /><span><strong>Registo protegido.</strong> Esta ocorrência será visível apenas a unidades com autorização compatível.</span></div><form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
    
    <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)] sm:p-7"><SectionTitle number="01" title="Tipo de ocorrência" note="Escolha o fluxo que melhor descreve a situação." /><div className="mt-5 grid gap-3 sm:grid-cols-2"><button data-testid="button-kind-missing" type="button" onClick={() => setKind('missing')} className={cn('rounded-xl border p-4 text-left transition-all', kind === 'missing' ? 'border-[#b77b32] bg-[#fff5e3] ring-2 ring-[#e9aa4b]/20' : 'border-[#dedbd2] hover:border-[#becbc3]')}><AlertTriangle size={18} className={kind === 'missing' ? 'text-[#ae7430]' : 'text-[#76857e]'} /><span className="mt-3 block text-sm font-semibold text-[#315963]">Pessoa desaparecida</span><span className="mt-1 block text-[11px] text-[#7d8983]">A pessoa não foi localizada e a família ou unidade comunicou o desaparecimento.</span></button><button data-testid="button-kind-found" type="button" onClick={() => setKind('found')} className={cn('rounded-xl border p-4 text-left transition-all', kind === 'found' ? 'border-[#438174] bg-[#e6f5ee] ring-2 ring-[#5aab90]/20' : 'border-[#dedbd2] hover:border-[#becbc3]')}><Check size={18} className={kind === 'found' ? 'text-[#347768]' : 'text-[#76857e]'} /><span className="mt-3 block text-sm font-semibold text-[#315963]">Pessoa encontrada</span><span className="mt-1 block text-[11px] text-[#7d8983]">Pessoa localizada sem confirmação imediata de identidade ou contacto familiar.</span></button></div></section>

    <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)] sm:p-7"><SectionTitle number="02" title="Identidade" note="Preencha o que foi confirmado. Campos desconhecidos podem ficar em branco." /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nome completo" required placeholder="Nome completo" value={name} onChange={setName} testId="input-case-name" /><Field label="Número de identificação" placeholder="BI ou outro documento" value={idNumber} onChange={setIdNumber} testId="input-case-id" /><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Data de nascimento</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div><Field label="Nome dos pais" placeholder="Filiação" value={parents} onChange={setParents} testId="input-case-parents" /><Field label="Telefone de referência" placeholder="+244..." value={phone} onChange={setPhone} testId="input-case-phone" /><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Província *</label><select value={province} onChange={(e) => { setProvince(e.target.value); setMunicipality(''); }} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#506b70] outline-none"><option value="">Selecione a província</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Município *</label><select value={municipality} onChange={(e) => setMunicipality(e.target.value)} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#506b70] outline-none"><option value="">Selecione o município</option>{municipalityList.map((m) => <option key={m}>{m}</option>)}</select></div></div></section>

    <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)] sm:p-7"><SectionTitle number="03" title="Última vez vista" note="Ajude outras equipas a reconhecer e agir sobre este caso." /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Local" placeholder="Local da última vez vista" value={location} onChange={setLocation} testId="input-case-location" /><div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Hora</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div></div><div className="mt-4"><Field label="Roupa e características particulares" placeholder="Descreva vestuário, acessórios ou marcas distintivas" value={clothing} onChange={setClothing} testId="input-case-clothing" /></div>
    <div className="mt-5"><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Fotografia <span className="text-[#ae7430]">*</span></label><div className="relative flex items-center gap-4 rounded-xl border-2 border-dashed border-[#d3d6ce] bg-[#fdfcf8] p-5 text-center transition-colors hover:border-[#8aaa9e] hover:bg-[#f4f8f6]">{photoPreview ? <div className="flex items-center gap-3"><img src={photoPreview} alt="Pré-visualização" className="h-16 w-16 rounded-lg object-cover" /><div className="text-left"><p className="text-xs font-semibold text-[#315963]">{photoFile?.name}</p><p className="text-[10px] text-[#7d8983]">{photoFile ? `${(photoFile.size / 1024).toFixed(0)} KB` : ''}</p><button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="mt-1 text-[10px] font-semibold text-[#ae7430] hover:underline">Remover</button></div></div> : <><Camera size={20} className="text-[#8aaa9e]" /><div><p className="text-xs font-semibold text-[#42665f]">Adicionar uma fotografia</p><p className="mt-0.5 text-[10px] text-[#8a9690]">JPG ou PNG até 5 MB · opcional nesta fase</p></div><input ref={(el) => { if (el) (fileInputRef as any)[0] = el; }} type="file" accept="image/jpeg,image/png" onChange={handlePhotoSelect} className="absolute inset-0 cursor-pointer opacity-0" /></>}</div></div></div></section>

    <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)] sm:p-7"><SectionTitle number="04" title="Privacidade e responsabilidade" note="Defina o alcance da informação e confirme a finalidade do registo." /><label className="mt-4 flex items-start gap-3 rounded-lg border border-[#e6e3db] p-3"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 accent-[#347768]" /><span className="text-[11px] leading-relaxed text-[#526c70]">Confirmo que esta informação foi obtida no exercício das minhas funções e será usada exclusivamente para localizar, identificar ou proteger a pessoa registada. A partilha não autorizada é proibida.</span></label><div className="mt-4"><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Visibilidade inicial: <span className="text-[#ae7430]">Restrito à unidade*</span></label></div></section>

    <div className="flex items-center justify-end gap-3"><Button variant="secondary" testId="button-save-draft" onClick={() => submit()}>Guardar rascunho</Button><button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174858] disabled:opacity-50">{uploading ? 'A enviar...' : 'Guardar e submeter'}</button></div>
  </form></div></div>;
}
function SectionTitle({ number, title, note }: { number: string; title: string; note: string }) { return <div className="flex gap-3"><span className="font-mono text-[10px] text-[#ae7430]">{number}</span><div><h2 className="font-display text-lg font-bold text-[#214554]">{title}</h2><p className="mt-0.5 text-xs text-[#7a8781]">{note}</p></div></div>; }
function Field({ label, required, placeholder, value, onChange, testId }: { label: string; required?: boolean; placeholder: string; value?: string; onChange?: (v: string) => void; testId: string }) { return <div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">{label} {required && <span className="text-[#ae7430]">*</span>}</label><input data-testid={testId} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors placeholder:text-[#a5aca5] focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div>; }

function CaseDetail({ cases }: { cases: PersonCase[] }) {
  const { id } = useParams<{ id: string }>(); const item = cases.find((c) => c.id === id); const [tab, setTab] = useState<'overview' | 'timeline' | 'permissions'>('overview'); const [confirmed, setConfirmed] = useState(false);
  if (!item) return <NotFoundPage />;
  return <div className="fade-up"><div className="mb-5 flex items-center gap-2 text-[11px] text-[#75827c]"><Link data-testid="link-back-cases" href="/ocorrencias" className="hover:text-[#ae7430]">Ocorrências</Link><ChevronRight size={13} /><span>{item.reference}</span></div><PageHeader eyebrow={item.reference} title={item.name} description={`${item.category} · registada em ${item.created}`} actions={<><Button variant="secondary" icon={Printer} testId="button-print-case" onClick={() => window.print()}>Imprimir</Button><Button variant="secondary" icon={MoreHorizontal} testId="button-more-case">Mais acções</Button></>} /><div className="mb-5 flex flex-wrap items-center gap-3"><Badge tone={statusTone[item.status]}>{item.status}</Badge><span className="flex items-center gap-1.5 text-[11px] text-[#687b76]"><LockKeyhole size={13} className="text-[#ae7430]" />{item.visibility}</span><span className="font-mono text-[10px] text-[#8e9891]">Última actualização: {item.updated}</span></div><div className="grid gap-5 xl:grid-cols-[1.5fr_.7fr]"><div className="space-y-5"><div className="flex rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-1 shadow-[var(--shadow-sm)]"><button data-testid="tab-case-overview" onClick={() => setTab('overview')} className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-semibold', tab === 'overview' ? 'bg-[#e7efeb] text-[#285f62]' : 'text-[#7b8982] hover:text-[#365d64]')}>Resumo do caso</button><button data-testid="tab-case-timeline" onClick={() => setTab('timeline')} className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-semibold', tab === 'timeline' ? 'bg-[#e7efeb] text-[#285f62]' : 'text-[#7b8982] hover:text-[#365d64]')}>Linha de actividade</button><button data-testid="tab-case-permissions" onClick={() => setTab('permissions')} className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-semibold', tab === 'permissions' ? 'bg-[#e7efeb] text-[#285f62]' : 'text-[#7b8982] hover:text-[#365d64]')}>Permissões</button></div>{tab === 'overview' && <><section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><SectionTitle number="01" title="Identificação" note="Dados conhecidos e autorizados para este caso." /><div className="mt-5 grid gap-y-5 sm:grid-cols-3"><Detail label="Nome completo" value={item.name} /><Detail label="Idade" value={`${item.age} anos`} /><Detail label="Data de nascimento" value={item.birthDate} /><Detail label="Filiação" value={item.parents} /><Detail label="N.º identificação" value={item.idNumber} /><Detail label="Telefone" value={item.phone} /></div></section><section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><SectionTitle number="02" title="Contexto e localização" note="Última informação confirmada no registo." /><div className="mt-5 grid gap-y-5 sm:grid-cols-2"><Detail label="Província / município" value={`${item.province} · ${item.municipality}`} /><Detail label="Data e hora" value={`${item.date} · ${item.time}`} /><Detail label="Local" value={item.location} /><Detail label="Roupa e características" value={item.clothing} /></div></section></>}{tab === 'timeline' && <Timeline events={item.timeline} />}{tab === 'permissions' && <Permissions visibility={item.visibility} />}</div><aside className="space-y-5"><div className="flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-[#d9d8cf] bg-[#e8e6de] text-center">{item.photo_file_id ? <img src={`/api/photos/${item.photo_file_id}?raw=1`} alt={item.name} className="h-40 w-40 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <><div className="grid h-16 w-16 place-items-center rounded-full bg-[#d3dcd6] text-[#6d837c]"><Camera size={25} /></div><p className="mt-3 text-xs font-semibold text-[#627873]">Fotografia pendente</p><p className="mt-1 max-w-[180px] text-[10px] leading-relaxed text-[#8a9690]">A unidade responsável ainda não anexou uma imagem.</p></>}</div><div className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><div className="mb-4 flex items-center gap-2"><Building2 size={16} className="text-[#ae7430]" /><h3 className="font-display text-base font-bold text-[#214554]">Responsabilidade</h3></div><Detail label="Unidade atribuída" value={item.unit} /><div className="my-4 border-t border-[#eeeae2]" /><Detail label="Agente responsável" value={item.officer} /><div className="my-4 border-t border-[#eeeae2]" /><Detail label="Nível de visibilidade" value={item.visibility} /></div><div className="rounded-xl border border-[#d9e3de] bg-[#eef5f1] p-4"><div className="flex gap-2"><Shield size={15} className="mt-0.5 shrink-0 text-[#347768]" /><p className="text-[10px] leading-relaxed text-[#517269]">Cada consulta e alteração a este registo fica guardada na auditoria. Partilhe apenas quando necessário.</p></div></div><Button variant={confirmed ? 'secondary' : 'primary'} onClick={() => setConfirmed(true)} icon={confirmed ? Check : UserCheck} testId="button-mark-followup" >{confirmed ? 'Acompanhamento registado' : 'Registar acompanhamento'}</Button></aside></div></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[#939d96]">{label}</p><p className="text-[12px] leading-relaxed text-[#426069]">{value}</p></div>; }
function Timeline({ events }: { events: PersonCase['timeline'] }) { return <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><SectionTitle number="03" title="Linha de actividade" note="Registo cronológico de alterações, acessos e decisões." /><div className="mt-6 space-y-0">{events.concat([{ date: '18 Jun 2025', label: 'Registo criado no sistema', note: 'A ocorrência foi iniciada.', actor: 'Sistema Localiza', tone: '' }]).map((event, index) => <div className="relative flex gap-4 pb-7 last:pb-0" key={`${event.label}-${index}`}><div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-4 border-[#fbfaf6] bg-[#d9e9e4] text-[#2d6c69]"><Check size={12} /></div>{index < events.length && <div className="absolute left-[13px] top-7 h-full w-px bg-[#d9e1db]" />}<div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-[#426069]">{event.label}</p><span className="font-mono text-[9px] text-[#9aa29c]">{event.date}</span></div><p className="mt-1 text-[11px] leading-relaxed text-[#7d8983]">{event.note}</p><p className="mt-1.5 text-[10px] text-[#ae7430]">{event.actor}</p></div></div>)}</div></section>; }
function Permissions({ visibility }: { visibility: string }) { return <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><SectionTitle number="04" title="Permissões do registo" note="Quem pode consultar ou operar sobre este caso." /><div className="mt-5 space-y-3">{[['Comando Provincial responsável', 'Consultar e actualizar', true], ['Unidades policiais autorizadas', 'Consultar dados essenciais', true], ['Instituições parceiras', visibility === 'Partilhado' ? 'Consultar informação partilhada' : 'Sem acesso', visibility === 'Partilhado'], ['Acesso público', 'Sem acesso', false]].map(([name, action, allowed]) => <div className="flex items-center gap-3 rounded-lg border border-[#e6e3db] p-3" key={String(name)}><div className={cn('grid h-8 w-8 place-items-center rounded-lg', allowed ? 'bg-[#e4f0eb] text-[#347768]' : 'bg-[#f0eeea] text-[#9a9e96]')}><Users size={15} /></div><div className="flex-1"><p className="text-xs font-semibold text-[#49656a]">{name}</p><p className="mt-0.5 text-[10px] text-[#89938d]">{action}</p></div>{allowed ? <Check size={16} className="text-[#347768]" /> : <X size={16} className="text-[#a0a7a0]" />}</div>)}</div></section>; }

function SearchPage({ cases }: { cases: PersonCase[] }) { const [query, setQuery] = useState(''); const [searched, setSearched] = useState(false); const results = searched ? cases.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.parents.toLowerCase().includes(query.toLowerCase()) || c.location.toLowerCase().includes(query.toLowerCase())) : []; return <div className="fade-up"><PageHeader eyebrow="Inteligência operacional" title="Pesquisa cruzada" description="Cruze sinais de identidade, contexto e localização nos registos autorizados." actions={<Badge tone="bg-[#e7efeb] text-[#326760] border-[#c8ddd3]"><Shield size={12} className="mr-1" /> Consulta auditada</Badge>} /><div className="grid gap-5 xl:grid-cols-[340px_1fr]"><section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><div className="mb-5 flex items-center gap-2"><Filter size={16} className="text-[#ae7430]" /><h2 className="font-display text-base font-bold text-[#214554]">Critérios de pesquisa</h2></div><div className="space-y-4"><Field label="Nome ou palavras-chave" placeholder="Ex.: Ana Isabel" value={query} onChange={setQuery} testId="input-cross-search" /><Field label="N.º identificação" placeholder="BI, cédula..." testId="input-cross-id" /><Field label="Telefone" placeholder="+244..." testId="input-cross-phone" /><Field label="Filiação" placeholder="Nome do pai ou mãe" testId="input-cross-parents" /><div className="grid grid-cols-2 gap-3"><Field label="Desde" placeholder="DD/MM/AAAA" testId="input-cross-from" /><Field label="Até" placeholder="DD/MM/AAAA" testId="input-cross-to" /></div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Província</label><select data-testid="select-cross-province" className="h-10 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#506b70]"><option>Todas as províncias</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select><Field label="Características / roupa" placeholder="Sinais particulares..." testId="input-cross-characteristics" /><Button icon={Search} onClick={() => setSearched(true)} testId="button-run-search">Pesquisar nos registos</Button><button data-testid="button-reset-cross-search" onClick={() => { setQuery(''); setSearched(false); }} className="w-full py-2 text-[11px] font-semibold text-[#7b8982] hover:text-[#ae7430]">Limpar critérios</button></div></section><section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between border-b border-[#ebe7de] px-5 py-4"><div><h2 className="font-display text-base font-bold text-[#214554]">Resultados</h2><p className="mt-0.5 text-[11px] text-[#7e8983]">{searched ? `${results.length} correspondência${results.length === 1 ? '' : 's'} encontrada${results.length === 1 ? '' : 's'}` : 'Aguardando critérios de pesquisa'}</p></div>{searched && <Badge tone="bg-[#fff0d6] text-[#8b5a12] border-[#efd49b]">Pesquisa registada</Badge>}</div>{!searched ? <EmptyState icon={Search} title="Comece uma pesquisa" note="Combine dois ou mais critérios para encontrar correspondências com mais precisão." /> : results.length === 0 ? <EmptyState icon={XCircle} title="Sem correspondências" note="Não foram encontrados registos compatíveis. Tente alargar os critérios." /> : <div className="divide-y divide-[#eeeae2]">{results.map((item) => <Link data-testid={`link-search-result-${item.id}`} href={`/ocorrencias/${item.id}`} key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#f8f6f0]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#deebe7] text-[10px] font-bold text-[#28616a]">{item.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-[#2b535e]">{item.name}</p><Badge tone={statusTone[item.status]}>{item.status}</Badge></div><p className="mt-1 text-[10px] text-[#82908a]">{item.reference} · {item.province} · {item.location}</p></div><ChevronRight size={16} className="text-[#a9b1aa]" /></Link>)}</div>}</section></div></div>; }

function UsersPage() { const users = [['Ana Martins', 'Administrador provincial', 'Comando Provincial de Luanda', 'Activo'], ['Paulo Manuel', 'Agente de polícia autorizado', 'Comando Provincial de Luanda', 'Activo'], ['Elisa Pedro', 'Agente de polícia autorizado', 'Comando Provincial de Benguela', 'Activo'], ['Rui Sebastião', 'Instituição parceira', 'Hospital Central do Lubango', 'Pendente']]; const [show, setShow] = useState(false); return <div className="fade-up"><PageHeader eyebrow="Governação" title="Utilizadores" description="Acesso de pessoas autorizadas à rede Localiza." actions={<Button icon={Plus} onClick={() => setShow(!show)} testId="button-add-user">Adicionar utilizador</Button>} />{show && <InlineForm title="Novo utilizador" onClose={() => setShow(false)} /> }<ManagementTable headers={['Utilizador', 'Perfil de acesso', 'Unidade', 'Estado']} rows={users} icon={UserCog} /> </div>; }
function InstitutionsPage() { const items = [['Comando Provincial de Luanda', 'Unidade policial', 'Luanda', '12 utilizadores'], ['Comando Provincial de Benguela', 'Unidade policial', 'Benguela', '8 utilizadores'], ['Hospital Central do Lubango', 'Instituição parceira', 'Huíla', '2 utilizadores'], ['Serviço de Investigação Criminal', 'Unidade nacional', 'Luanda', '15 utilizadores']]; const [show, setShow] = useState(false); return <div className="fade-up"><PageHeader eyebrow="Governação" title="Instituições" description="Unidades e parceiros que participam na rede de localização." actions={<Button icon={Plus} onClick={() => setShow(!show)} testId="button-add-institution">Adicionar instituição</Button>} />{show && <InlineForm title="Nova instituição" onClose={() => setShow(false)} /> }<ManagementTable headers={['Instituição', 'Tipo', 'Localização', 'Acesso']} rows={items} icon={Building2} /></div>; }
function ManagementTable({ headers, rows, icon: Icon }: { headers: string[]; rows: string[][]; icon: LucideIcon }) { return <div className="overflow-x-auto rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-[#ebe7de] bg-[#f7f4ee] font-mono text-[9px] uppercase tracking-wider text-[#89948d]">{headers.map((h) => <th className="px-5 py-3 font-normal" key={h}>{h}</th>)}<th /></tr></thead><tbody className="divide-y divide-[#eeeae2]">{rows.map((row, i) => <tr className="hover:bg-[#f8f6f0]" data-testid={`row-management-${i}`} key={row[0]}><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e3ede9] text-[#397169]"><Icon size={15} /></span><span className="text-xs font-semibold text-[#385d65]">{row[0]}</span></div></td>{row.slice(1).map((value, j) => <td className="px-5 py-3.5 text-[11px] text-[#71817b]" key={j}>{j === row.length - 2 ? <Badge tone={value === 'Pendente' ? 'bg-[#fff0d6] text-[#8b5a12] border-[#efd49b]' : undefined}>{value}</Badge> : value}</td>)}<td className="px-5 py-3.5 text-right"><button data-testid={`button-management-${i}`} className="rounded p-1.5 text-[#89958d] hover:bg-[#e9efeb]"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>; }
function InlineForm({ title, onClose }: { title: string; onClose: () => void }) { const [done, setDone] = useState(false); return <div className="mb-5 rounded-xl border border-[#cbded5] bg-[#eef6f1] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-[#315f60]">{title}</h2><button data-testid="button-close-inline-form" onClick={onClose}><X size={16} className="text-[#718b82]" /></button></div>{done ? <div className="mt-3 text-xs text-[#347768]">Registo guardado localmente. Pode continuar a gerir o acesso.</div> : <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input data-testid="input-inline-name" placeholder="Nome ou designação" className="h-9 flex-1 rounded-lg border border-[#cddbd4] bg-[#fbfaf6] px-3 text-xs outline-none" /><select data-testid="select-inline-type" className="h-9 rounded-lg border border-[#cddbd4] bg-[#fbfaf6] px-3 text-xs"><option>Perfil / tipo</option><option>Administrador</option><option>Agente autorizado</option><option>Instituição parceira</option></select><Button onClick={() => setDone(true)} testId="button-save-inline">Guardar</Button></div>}</div>; }

function AuditPage() { const logs = [['Hoje, 08:42', 'Ana Martins', 'Consultou', 'LZA-2025-00481', 'Consulta de detalhes'], ['Ontem, 15:25', 'Elisa Pedro', 'Actualizou', 'LZA-2025-00477', 'Estado alterado para Encontrada'], ['17 Jun, 16:10', 'Paulo Manuel', 'Executou pesquisa', 'Pesquisa cruzada', 'Nome + província Luanda'], ['17 Jun, 11:33', 'Rui Sebastião', 'Tentou consultar', 'LZA-2025-00438', 'Acesso não autorizado'], ['16 Jun, 19:31', 'Artur Domingos', 'Actualizou', 'LZA-2025-00438', 'Estado alterado para Localizada']]; return <div className="fade-up"><PageHeader eyebrow="Controlo e confiança" title="Auditoria" description="Histórico de acessos, pesquisas e alterações na sua área de responsabilidade." actions={<Button variant="secondary" icon={CalendarDays} testId="button-audit-date">Últimos 30 dias</Button>} /><div className="mb-5 flex items-center gap-3 rounded-xl border border-[#d5e2dc] bg-[#eaf2ee] px-4 py-3 text-xs text-[#42665f]"><Shield size={16} /><span>O histórico é imutável e visível apenas para perfis de administração autorizados.</span></div><div className="overflow-x-auto rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#ebe7de] bg-[#f7f4ee] font-mono text-[9px] uppercase tracking-wider text-[#89948d]"><th className="px-5 py-3 font-normal">Data / hora</th><th className="px-3 py-3 font-normal">Utilizador</th><th className="px-3 py-3 font-normal">Acção</th><th className="px-3 py-3 font-normal">Alvo</th><th className="px-3 py-3 font-normal">Contexto</th></tr></thead><tbody className="divide-y divide-[#eeeae2]">{logs.map((log, i) => <tr data-testid={`row-audit-${i}`} className="hover:bg-[#f8f6f0]" key={log.join('-')}><td className="px-5 py-4 font-mono text-[10px] text-[#72817a]">{log[0]}</td><td className="px-3 py-4 text-[11px] font-semibold text-[#48646a]">{log[1]}</td><td className="px-3 py-4"><span className="rounded bg-[#e7efeb] px-2 py-1 text-[10px] font-semibold text-[#397169]">{log[2]}</span></td><td className="px-3 py-4 font-mono text-[10px] text-[#ae7430]">{log[3]}</td><td className="px-3 py-4 text-[11px] text-[#7b8982]">{log[4]}</td></tr>)}</tbody></table></div></div>; }

function NotificationsPage() { const [items, setItems] = useState([{ id: 1, title: 'Acompanhamento pendente', note: 'LZA-2025-00481 não tem nova actividade há 24 horas.', time: 'Hoje, 08:42', priority: true }, { id: 2, title: 'Correspondência potencial', note: 'Novo registo na Huíla com características semelhantes a um caso activo.', time: 'Ontem, 15:25', priority: true }, { id: 3, title: 'Acesso revisto', note: 'O seu perfil foi actualizado pelo administrador nacional.', time: '17 Jun, 11:33', priority: false }]); return <div className="fade-up"><PageHeader eyebrow="Centro de alertas" title="Notificações" description="Acompanhe alertas operacionais e itens que pedem a sua atenção." actions={<Button variant="secondary" onClick={() => setItems([])} testId="button-mark-all-read" icon={Check}>Marcar todas como lidas</Button>} />{items.length ? <div className="max-w-3xl divide-y divide-[#eeeae2] overflow-hidden rounded-xl border border-[#dedbd2] bg-[#fbfaf6] shadow-[var(--shadow-sm)]">{items.map((item) => <div data-testid={`notification-${item.id}`} key={item.id} className="flex gap-4 p-5 hover:bg-[#f8f6f0]"><div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg', item.priority ? 'bg-[#fff0d6] text-[#ae7430]' : 'bg-[#e4eee9] text-[#347768]')}>{item.priority ? <AlertTriangle size={17} /> : <Check size={17} />}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-[#3a5d64]">{item.title}</p>{item.priority && <Badge tone="bg-[#fff0d6] text-[#8b5a12] border-[#efd49b]">Prioridade</Badge>}</div><p className="mt-1 text-[11px] leading-relaxed text-[#788680]">{item.note}</p><p className="mt-2 font-mono text-[9px] text-[#9ca49e]">{item.time}</p></div><button data-testid={`button-dismiss-notification-${item.id}`} onClick={() => setItems(items.filter((x) => x.id !== item.id))} className="self-start rounded p-1 text-[#99a29b] hover:bg-[#e8e5dc] hover:text-[#526d70]"><X size={15} /></button></div>)}</div> : <EmptyState icon={Bell} title="Tudo em dia" note="Não há notificações pendentes para a sua vista." action={<Link data-testid="link-notifications-dashboard" href="/dashboard" className="text-xs font-semibold text-[#ae7430]">Voltar à visão geral</Link>} />}</div>; }

function SettingsPage({ notificationsOn, setNotificationsOn }: { notificationsOn: boolean; setNotificationsOn: (v: boolean) => void }) { const [saved, setSaved] = useState(false); return <div className="fade-up"><PageHeader eyebrow="Preferências da conta" title="Definições" description="Ajuste a sua experiência sem alterar as regras de acesso da rede." actions={saved ? <Badge tone="bg-[#e4f0eb] text-[#347768] border-[#c5ddd2]"><Check size={12} className="mr-1" /> Guardado</Badge> : <Button onClick={() => setSaved(true)} testId="button-save-settings">Guardar alterações</Button>} /><div className="grid max-w-4xl gap-5 lg:grid-cols-2"><SettingsCard icon={UserCog} title="Conta" note="Como aparece na rede Localiza"><SettingRow label="Nome de apresentação" value="Ana Martins" /><SettingRow label="Unidade" value="Comando Provincial de Luanda" /><SettingRow label="Perfil" value="Administrador provincial" locked /></SettingsCard><SettingsCard icon={LockKeyhole} title="Segurança" note="Proteja a sua sessão e actividade"><SettingRow label="Autenticação de dois factores" value="Activa" toggle /><SettingRow label="Tempo de sessão" value="30 minutos" /><SettingRow label="Alterar palavra-passe" value="Actualizar" action /></SettingsCard><SettingsCard icon={Bell} title="Notificações" note="Escolha o que quer acompanhar"><SettingRow label="Alertas operacionais" value="Receber no sistema" toggle checked={notificationsOn} onToggle={() => setNotificationsOn(!notificationsOn)} /><SettingRow label="Correspondências potenciais" value="Prioridade alta" toggle checked /><SettingRow label="Resumo semanal" value="Não subscrito" toggle /></SettingsCard><SettingsCard icon={Shield} title="Acesso e privacidade" note="Regras visíveis para esta conta"><SettingRow label="Nível actual" value="Provincial · Luanda" locked /><SettingRow label="Registos consultados" value="Ver histórico de auditoria" action /><SettingRow label="Política de privacidade" value="Ler política" action /></SettingsCard></div></div>; }
function SettingsCard({ icon: Icon, title, note, children }: { icon: LucideIcon; title: string; note: string; children: ReactNode }) { return <section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e4eeea] text-[#327069]"><Icon size={17} /></span><div><h2 className="font-display text-base font-bold text-[#214554]">{title}</h2><p className="mt-0.5 text-[10px] text-[#84908a]">{note}</p></div></div><div className="divide-y divide-[#eeeae2]">{children}</div></section>; }
function SettingRow({ label, value, toggle, checked = false, onToggle, locked, action }: { label: string; value: string; toggle?: boolean; checked?: boolean; onToggle?: () => void; locked?: boolean; action?: boolean }) { return <div className="flex items-center justify-between gap-3 py-3"><div><p className="text-[11px] font-semibold text-[#526c70]">{label}</p><p className="mt-0.5 text-[10px] text-[#89958e]">{value}</p></div>{toggle ? <button data-testid={`toggle-setting-${label}`} onClick={onToggle} className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-[#347768]' : 'bg-[#cbd3cc]')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} /></button> : locked ? <LockKeyhole size={14} className="text-[#a1aaa2]" /> : action ? <ChevronRight size={15} className="text-[#a1aaa2]" /> : null}</div>; }

function HelpPage() { const [open, setOpen] = useState<number | null>(0); const faqs = [['Quando devo criar uma ocorrência?', 'Crie um registo assim que uma pessoa seja comunicada como desaparecida, encontrada sem identificação ou localizada. Evite duplicar participações: pesquise primeiro pelo nome, filiação e local.'], ['Quem pode ver uma ocorrência restrita?', 'Apenas a unidade responsável e perfis com autorização compatível. O sistema regista todas as consultas, incluindo tentativas sem permissão.'], ['Como encerro um caso?', 'Confirme a identidade e a localização com a fonte responsável. Depois, actualize o estado e escreva uma nota objectiva na linha de actividade.'], ['O que faço quando há informação incompleta?', 'Guarde um rascunho com o que foi confirmado. Nunca preencha campos com suposições; use “não informado” quando necessário.']]; return <div className="fade-up"><PageHeader eyebrow="Orientação e suporte" title="Ajuda operacional" description="Boas práticas para trabalhar com informação sensível com rapidez e dignidade." /><div className="grid gap-5 lg:grid-cols-[1fr_300px]"><section className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5 shadow-[var(--shadow-sm)]"><div className="mb-5 flex items-center gap-2"><BookOpen size={17} className="text-[#ae7430]" /><h2 className="font-display text-lg font-bold text-[#214554]">Perguntas frequentes</h2></div><div className="divide-y divide-[#eeeae2]">{faqs.map(([q, a], i) => <div key={q}><button data-testid={`button-faq-${i}`} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-xs font-semibold text-[#426069]"><span>{q}</span><ChevronDown size={16} className={cn('shrink-0 text-[#9aa49c] transition-transform', open === i && 'rotate-180')} /></button>{open === i && <p className="max-w-2xl pb-4 pr-8 text-[11px] leading-relaxed text-[#778680]">{a}</p>}</div>)}</div></section><aside className="space-y-4"><div className="rounded-xl bg-[#173e4d] p-5 text-[#eff3ee]"><LifeBuoy size={20} className="text-[#e9aa4b]" /><h2 className="mt-4 font-display text-lg font-bold">Precisa de apoio?</h2><p className="mt-2 text-[11px] leading-relaxed text-[#bfd0ca]">A equipa de suporte operacional está disponível para questões de acesso, privacidade ou utilização.</p><button data-testid="button-contact-support" className="mt-5 flex items-center gap-2 rounded-lg bg-[#e9aa4b] px-3 py-2 text-[11px] font-bold text-[#173e4d] hover:bg-[#f0b961]"><Phone size={14} /> Contactar suporte</button></div><div className="rounded-xl border border-[#dedbd2] bg-[#fbfaf6] p-5"><div className="flex gap-2"><Shield size={16} className="shrink-0 text-[#347768]" /><div><h3 className="text-xs font-semibold text-[#426069]">Lembrete de privacidade</h3><p className="mt-2 text-[10px] leading-relaxed text-[#7d8983]">Não descarregue, fotografe ou partilhe informação de casos fora dos canais autorizados.</p></div></div></div></aside></div></div>; }

function Login({ onEnter }: { onEnter: (user: any) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
      const data = await res.json();
      if (data.ok) { onEnter(data.user); } else { setError(data.error || 'Credenciais invalidas.'); }
    } catch { setError('Erro de conexao com o servidor.'); }
    setLoading(false);
  };
  return <div className="app-noise flex min-h-[100dvh] bg-[#173e4d]"><div className="hidden w-[43%] flex-col justify-between bg-[#214f5e] p-10 text-[#eef3ed] lg:flex"><div><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9aa4b] text-[#173e4d]"><Fingerprint size={23} /></span><div><div className="font-display text-xl font-bold">LOCALIZA</div><div className="font-mono text-[9px] tracking-[.2em] text-[#abc5c0]">ANGOLA</div></div></div><div className="mt-28 max-w-md"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#e9aa4b]">Rede nacional de localizacao</p><h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-[-.05em]">Cada pessoa<br />de volta a casa.</h1><p className="mt-6 max-w-sm text-sm leading-relaxed text-[#c5d7d0]">Uma rede segura para registar, encontrar e acompanhar pessoas - com contexto, responsabilidade e respeito.</p></div></div><div><div className="mb-3 h-px w-12 bg-[#e9aa4b]" /><p className="max-w-xs text-[11px] leading-relaxed text-[#adc5bf]">Plataforma de uso restrito para unidades policiais e instituicoes parceiras autorizadas.</p></div></div><div className="flex flex-1 items-center justify-center bg-[#f4f1ea] px-5 py-10 sm:px-10"><div className="w-full max-w-[390px]"><div className="mb-12 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9aa4b] text-[#173e4d]"><Fingerprint size={21} /></span><div className="font-display text-lg font-bold text-[#214554]">LOCALIZA <span className="font-mono text-[9px] tracking-wider text-[#7b8982]">ANGOLA</span></div></div><div className="mb-8"><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#ae7430]"><LockKeyhole size={13} />Acesso restrito</div><h2 className="font-display text-3xl font-bold tracking-[-.04em] text-[#214554]">Entrar na plataforma</h2><p className="mt-2 text-xs text-[#778680]">Utilize as suas credenciais de acesso atribuidas pela administracao.</p></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Telefone <span className="text-[#ae7430]">*</span></label><input data-testid="input-login-user" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 999999999" className="h-11 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors placeholder:text-[#a5aca5] focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[#526c70]">Senha <span className="text-[#ae7430]">*</span></label><input data-testid="input-login-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Introduza a sua senha" className="h-11 w-full rounded-lg border border-[#d3d6ce] bg-[#fdfcf8] px-3 text-xs text-[#365a63] outline-none transition-colors placeholder:text-[#a5aca5] focus:border-[#6d9994] focus:ring-2 focus:ring-[#6d9994]/10" /></div>{error && <p className="text-[11px] font-semibold text-[#c33]">{error}</p>}<button data-testid="button-login-submit" type="submit" disabled={loading} className="h-11 w-full rounded-lg bg-[#1e5668] text-xs font-semibold text-white transition-colors hover:bg-[#174858] disabled:opacity-50">{loading ? 'A entrar...' : 'Entrar'}</button><div className="pt-1 text-center text-[10px] text-[#96a09a]">Contacte o administrador para obter acesso.</div></form></div></div></div>; }

function EmptyState({ icon: Icon, title, note, action }: { icon: LucideIcon; title: string; note: string; action?: ReactNode }) { return <div className="flex min-h-[265px] flex-col items-center justify-center px-5 py-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8efea] text-[#477b72]"><Icon size={22} /></span><h3 className="mt-4 font-display text-base font-bold text-[#385a62]">{title}</h3><p className="mt-2 max-w-xs text-xs leading-relaxed text-[#84908a]">{note}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function NotFoundPage() { return <div className="flex min-h-[65vh] flex-col items-center justify-center text-center"><div className="font-mono text-5xl font-bold text-[#d7c49f]">404</div><h1 className="mt-4 font-display text-2xl font-bold text-[#214554]">Página não encontrada</h1><p className="mt-2 text-sm text-[#778680]">O endereço que procura não existe ou já não está disponível.</p><Link data-testid="link-not-found-home" href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1e5668] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#174858]"><Home size={15} />Voltar à visão geral</Link></div>; }

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppContent /></WouterRouter>;
}

export default App;