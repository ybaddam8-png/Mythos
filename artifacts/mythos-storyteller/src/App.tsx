import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowRight, ChevronLeft, Download, FileJson, LibraryBig, Pencil,
  Plus, RefreshCw, Search, Send, Sparkles, Trash2, X, ScrollText,
} from 'lucide-react';
import {
  getGetStoryQueryKey, getGetStoryStatsQueryKey, getListStoriesQueryKey,
  useAdvanceStory, useCreateStory, useDeleteStory, useGetStory, useGetStoryStats,
  useListStories, useUpdateStory,
} from '@workspace/api-client-react';
import type { Story, StoryInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const initialCharacter = {
  name: '', age: 28, role: '', personality: '', background: '', strengths: '',
  weaknesses: '', goal: '', fear: '', ability: '',
};
const initialForm: StoryInput = {
  title: '', genre: 'Fantasy', world: '', tone: 'Wonder with a shadow',
  length: 'Standard', difficulty: 'Balanced', style: 'Lyrical',
  character: initialCharacter,
};

function formatDate(value?: string) {
  if (!value) return 'Just now';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="page-shell">
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-brand">
          <span className="brand-mark" aria-hidden="true" /><span>mythos</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-home">Overview</Link>
          <Link href="/library" className={`nav-link ${location === '/library' ? 'active' : ''}`} data-testid="link-library">Library</Link>
          <Link href="/create" className="btn btn-primary btn-sm" data-testid="link-create"><Plus size={15} /> New story</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

function LoadingGrid({ count = 3 }: { count?: number }) {
  return <div className="story-grid" aria-label="Loading stories">{Array.from({ length: count }).map((_, index) => <div className="skeleton skeleton-card" key={index} data-testid={`skeleton-story-${index}`} />)}</div>;
}

function ErrorState({ message = 'The archive is quiet right now.' , onRetry }: { message?: string; onRetry: () => void }) {
  return <div className="error-state" data-testid="state-error"><Sparkles size={23} color="hsl(var(--primary))" /><h3>Something obscured the path</h3><p>{message} Try the route again and we will pick up where we left off.</p><button className="btn btn-ghost" onClick={onRetry} data-testid="button-retry"><RefreshCw size={14} /> Try again</button></div>;
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <div className="empty-state" data-testid="state-empty"><ScrollText size={24} color="hsl(var(--primary))" /><h3>{compact ? 'No stories match that search' : 'The first page is still blank'}</h3><p>{compact ? 'Try another title, genre, or character.' : 'Build a world with a secret worth keeping. Mythos will remember every turn.'}</p>{!compact && <Link href="/create" className="btn btn-primary" data-testid="link-empty-create"><Plus size={14} /> Begin a story</Link>}</div>;
}

function Stats({ stats, loading }: { stats?: { total: number; active: number; completed: number; choices: number }; loading: boolean }) {
  const values = [
    ['Stories', stats?.total ?? 0], ['In progress', stats?.active ?? 0],
    ['Completed', stats?.completed ?? 0], ['Choices made', stats?.choices ?? 0],
  ];
  return <div className="stats-row" data-testid="stats-row">{values.map(([label, value], index) => <div className="stat" key={label as string}><div className={loading ? 'skeleton skeleton-line' : 'stat-value'} data-testid={`stat-${String(label).toLowerCase().replace(' ', '-')}`}>{loading ? '' : value}</div><div className="stat-label">{label}</div></div>)}</div>;
}

function RenameModal({ story, onClose, onSaved }: { story: Story; onClose: () => void; onSaved: (story: Story) => void }) {
  const [title, setTitle] = useState(story.title);
  const update = useUpdateStory();
  const client = useQueryClient();
  const submit = () => {
    if (!title.trim() || update.isPending) return;
    update.mutate({ id: story.id, data: { title: title.trim() } }, {
      onSuccess: (updated) => {
        client.setQueryData(getGetStoryQueryKey(story.id), updated);
        client.invalidateQueries({ queryKey: getListStoriesQueryKey() });
        onSaved(updated); onClose();
      },
    });
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal"><button className="btn btn-ghost btn-sm" style={{ float: 'right' }} onClick={onClose} data-testid="button-close-rename"><X size={14} /></button><h2>Rename this world</h2><p>Give this adventure a title that brings the doorway back to mind.</p><div className="field"><label htmlFor="rename-title">Story title</label><input id="rename-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus data-testid="input-rename-title" /></div><div className="modal-actions"><button className="btn btn-ghost" onClick={onClose} data-testid="button-cancel-rename">Cancel</button><button className="btn btn-primary" onClick={submit} disabled={update.isPending || !title.trim()} data-testid="button-save-rename">{update.isPending ? 'Saving…' : 'Save title'}</button></div></div>
  </div>;
}

function StoryCard({ story, onDelete, onRename }: { story: Story; onDelete: (story: Story) => void; onRename: (story: Story) => void }) {
  const scene = story.scenes[story.scenes.length - 1];
  return <article className="story-card rise" data-testid={`card-story-${story.id}`}>
    <Link href={`/story/${story.id}`} data-testid={`link-story-${story.id}`}>
      <div className="card-kicker"><span>{story.genre}</span><span>{story.status === 'completed' ? 'Complete' : 'In progress'}</span></div>
      <h3>{story.title}</h3><p>{scene?.title ?? 'An untold beginning'}{scene?.location ? ` · ${scene.location}` : ''}</p>
    </Link>
    <div className="card-footer"><span>{formatDate(story.updatedAt)}</span><span style={{ display: 'flex', gap: '.3rem' }}><button className="btn btn-ghost btn-sm" onClick={() => onRename(story)} aria-label={`Rename ${story.title}`} data-testid={`button-rename-${story.id}`}><Pencil size={13} /></button><button className="btn btn-danger btn-sm" onClick={() => onDelete(story)} aria-label={`Delete ${story.title}`} data-testid={`button-delete-${story.id}`}><Trash2 size={13} /></button><Link className="btn btn-ghost btn-sm" href={`/story/${story.id}`} aria-label={`Resume ${story.title}`} data-testid={`link-resume-${story.id}`}><ArrowRight size={13} /></Link></span></div>
  </article>;
}

function StoryCollection({ stories, error, loading, onRetry }: { stories?: Story[]; error?: boolean; loading: boolean; onRetry: () => void }) {
  const [renameStory, setRenameStory] = useState<Story | null>(null);
  const [localStories, setLocalStories] = useState(stories);
  const remove = useDeleteStory();
  const client = useQueryClient();
  const currentStories = stories ?? localStories ?? [];
  const handleDelete = (story: Story) => {
    if (!window.confirm(`Delete “${story.title}” from your library? This cannot be undone.`)) return;
    remove.mutate({ id: story.id }, { onSuccess: () => { setLocalStories(currentStories.filter((item) => item.id !== story.id)); client.invalidateQueries({ queryKey: getListStoriesQueryKey() }); client.invalidateQueries({ queryKey: getGetStoryStatsQueryKey() }); } });
  };
  if (loading) return <LoadingGrid />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!currentStories.length) return <EmptyState />;
  return <><div className="story-grid">{currentStories.map((story) => <StoryCard key={story.id} story={story} onDelete={handleDelete} onRename={setRenameStory} />)}</div>{renameStory && <RenameModal story={renameStory} onClose={() => setRenameStory(null)} onSaved={(updated) => setLocalStories(currentStories.map((item) => item.id === updated.id ? updated : item))} />}</>;
}

function Home() {
  const stories = useListStories();
  const stats = useGetStoryStats();
  return <main className="page-main">
    <section className="hero">
      <div className="rise"><div className="eyebrow">A private library of impossible places</div><h1 className="display">Your choices.<br /><span style={{ color: 'hsl(var(--primary))' }}>Their consequences.</span></h1><p className="hero-copy">Mythos is an AI storybook that remembers the details. Step into a living adventure, shape it with a choice or a sentence, and return whenever the next page calls.</p><div className="hero-actions"><Link href="/create" className="btn btn-primary" data-testid="button-start-story"><Sparkles size={15} /> Open a new world <ArrowRight size={15} /></Link><Link href="/library" className="btn btn-ghost" data-testid="button-open-library"><LibraryBig size={15} /> Browse library</Link></div></div>
      <div className="orbit rise delay-2" aria-label="A constellation representing a story world"><div className="orbit-core" /><div className="orbit-label one">memory intact</div><div className="orbit-label two">the path bends</div><div className="orbit-label three">chapter 01</div></div>
    </section>
    <Stats stats={stats.data} loading={stats.isLoading} />
    <section><div className="section-head"><div><div className="eyebrow">Recently visited</div><h2>Continue your worlds</h2></div><Link href="/library" className="btn btn-ghost btn-sm" data-testid="link-see-all">See all <ArrowRight size={13} /></Link></div><StoryCollection stories={stories.data} loading={stories.isLoading} error={stories.isError} onRetry={() => stories.refetch()} /></section>
  </main>;
}

function Library() {
  const stories = useListStories();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => (stories.data ?? []).filter((story) => `${story.title} ${story.genre} ${story.character.name}`.toLowerCase().includes(search.toLowerCase())), [stories.data, search]);
  return <main className="page-main"><div className="section-head"><div><div className="eyebrow">The archive</div><h1 className="display" style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)', margin: '.6rem 0 0' }}>Every world<br />you left open.</h1></div><Link href="/create" className="btn btn-primary" data-testid="button-library-create"><Plus size={15} /> New story</Link></div><div className="search-line"><div className="search-wrap"><Search size={16} /><input className="search-input" type="search" placeholder="Search titles, genres, characters…" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-stories" /></div></div>{stories.isLoading ? <LoadingGrid count={6} /> : stories.isError ? <ErrorState onRetry={() => stories.refetch()} /> : filtered.length ? <StoryCollection stories={filtered} loading={false} onRetry={() => stories.refetch()} /> : <EmptyState compact />}</main>;
}

function Create() {
  const [form, setForm] = useState<StoryInput>(initialForm);
  const [error, setError] = useState('');
  const create = useCreateStory();
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const setStory = (key: keyof StoryInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const setCharacter = (key: keyof typeof initialCharacter, value: string | number) => setForm((current) => ({ ...current, character: { ...current.character, [key]: value } }));
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!form.title.trim() || !form.world.trim() || !form.character.name.trim() || !form.character.role.trim()) { setError('Name the story, world, protagonist, and role before opening the door.'); return; }
    create.mutate({ data: { ...form, title: form.title.trim(), world: form.world.trim(), character: { ...form.character, age: Number(form.character.age) } } }, {
      onSuccess: (story) => { client.invalidateQueries({ queryKey: getListStoriesQueryKey() }); client.invalidateQueries({ queryKey: getGetStoryStatsQueryKey() }); setLocation(`/story/${story.id}`); },
      onError: (error) => {
        const message = error instanceof Error ? error.message.replace(/^HTTP \d+[^:]*:\s*/, '') : '';
        setError(message || 'The opening could not be written. Check the details and try once more.');
      },
    });
  };
  return <main className="page-main"><div className="create-layout"><div className="create-intro rise"><div className="eyebrow">The world begins here</div><h1 className="display">Leave room for the unexpected.</h1><p>Tell Mythos enough to find the emotional weather of your story. The rest will arrive one scene at a time.</p><Link href="/library" className="btn btn-ghost" data-testid="link-create-back"><ChevronLeft size={15} /> Back to library</Link></div><form className="form-panel rise delay-1" onSubmit={submit}><section className="form-section"><h2>The cover</h2><div className="form-grid"><div className="field wide"><label htmlFor="story-title">Story title</label><input id="story-title" value={form.title} onChange={(e) => setStory('title', e.target.value)} placeholder="The Cartographer of Hollow Tides" maxLength={120} data-testid="input-story-title" /></div><div className="field"><label htmlFor="story-genre">Genre</label><select id="story-genre" value={form.genre} onChange={(e) => setStory('genre', e.target.value)} data-testid="select-genre">{['Fantasy','Mystery','Science fiction','Horror','Historical','Adventure'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="story-tone">Tone</label><input id="story-tone" value={form.tone} onChange={(e) => setStory('tone', e.target.value)} placeholder="Tender and strange" data-testid="input-story-tone" /></div><div className="field"><label htmlFor="story-world">World</label><textarea id="story-world" className="wide" value={form.world} onChange={(e) => setStory('world', e.target.value)} placeholder="A city that moves one street every midnight…" data-testid="textarea-story-world" /></div><div className="field"><label htmlFor="story-length">Length</label><select id="story-length" value={form.length} onChange={(e) => setStory('length', e.target.value)} data-testid="select-length">{['Short','Standard','Long','Epic'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="story-difficulty">Difficulty</label><select id="story-difficulty" value={form.difficulty} onChange={(e) => setStory('difficulty', e.target.value)} data-testid="select-difficulty">{['Gentle','Balanced','Unforgiving'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="story-style">Narrative style</label><input id="story-style" value={form.style} onChange={(e) => setStory('style', e.target.value)} placeholder="Lyrical" data-testid="input-story-style" /></div></div></section><section className="form-section"><h2>The one who enters</h2><div className="form-grid"><div className="field"><label htmlFor="character-name">Name</label><input id="character-name" value={form.character.name} onChange={(e) => setCharacter('name', e.target.value)} placeholder="Your protagonist" data-testid="input-character-name" /></div><div className="field"><label htmlFor="character-age">Age</label><input id="character-age" type="number" min="1" max="999" value={form.character.age} onChange={(e) => setCharacter('age', Number(e.target.value))} data-testid="input-character-age" /></div><div className="field"><label htmlFor="character-role">Role</label><input id="character-role" value={form.character.role} onChange={(e) => setCharacter('role', e.target.value)} placeholder="Reluctant archivist" data-testid="input-character-role" /></div><div className="field"><label htmlFor="character-ability">Ability</label><input id="character-ability" value={form.character.ability} onChange={(e) => setCharacter('ability', e.target.value)} placeholder="Can hear old stone remember" data-testid="input-character-ability" /></div><div className="field wide"><label htmlFor="character-personality">Personality</label><textarea id="character-personality" value={form.character.personality} onChange={(e) => setCharacter('personality', e.target.value)} placeholder="Observant, dryly funny, slow to trust…" data-testid="textarea-character-personality" /></div><div className="field wide"><label htmlFor="character-background">Background</label><textarea id="character-background" value={form.character.background} onChange={(e) => setCharacter('background', e.target.value)} placeholder="What did they leave behind?" data-testid="textarea-character-background" /></div><div className="field"><label htmlFor="character-strengths">Strengths</label><input id="character-strengths" value={form.character.strengths} onChange={(e) => setCharacter('strengths', e.target.value)} placeholder="Patience, maps, kindness" data-testid="input-character-strengths" /></div><div className="field"><label htmlFor="character-weaknesses">Weaknesses</label><input id="character-weaknesses" value={form.character.weaknesses} onChange={(e) => setCharacter('weaknesses', e.target.value)} placeholder="Avoids impossible choices" data-testid="input-character-weaknesses" /></div><div className="field"><label htmlFor="character-goal">Goal</label><textarea id="character-goal" value={form.character.goal} onChange={(e) => setCharacter('goal', e.target.value)} placeholder="What are they looking for?" data-testid="textarea-character-goal" /></div><div className="field"><label htmlFor="character-fear">Fear</label><textarea id="character-fear" value={form.character.fear} onChange={(e) => setCharacter('fear', e.target.value)} placeholder="What follows them?" data-testid="textarea-character-fear" /></div></div></section>{error && <p className="muted" style={{ color: 'hsl(var(--destructive))' }} data-testid="text-create-error">{error}</p>}<div className="form-actions"><button type="submit" className="btn btn-primary" disabled={create.isPending} data-testid="button-create-story">{create.isPending ? 'Writing the opening…' : <>Open the story <ArrowRight size={15} /></>}</button></div></form></div></main>;
}

function exportStory(story: Story, format: 'txt' | 'json') {
  const content = format === 'json' ? JSON.stringify(story, null, 2) : `${story.title}\n${'='.repeat(story.title.length)}\n\n${story.scenes.map((scene) => `CHAPTER ${scene.chapter} · ${scene.chapterTitle}\n${scene.title}\n${scene.location}\n\n${scene.narrative}\n\n${scene.playerAction ? `Your action: ${scene.playerAction}\n` : ''}`).join('\n')}`;
  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.${format}`; anchor.click(); URL.revokeObjectURL(url);
}

function StoryPage() {
  const { id = '' } = useParams<{ id: string }>();
  const storyQuery = useGetStory(id, { query: { enabled: !!id, queryKey: getGetStoryQueryKey(id) } });
  const advance = useAdvanceStory();
  const client = useQueryClient();
  const [custom, setCustom] = useState('');
  const [rename, setRename] = useState(false);
  const [selectedScene, setSelectedScene] = useState(0);
  const story = storyQuery.data;
  const currentScene = story?.scenes[selectedScene] ?? story?.scenes[story.scenes.length - 1];
  const act = (action: string | null) => {
    if (!story || advance.isPending) return;
    advance.mutate({ id: story.id, data: { action } }, { onSuccess: (updated) => { client.setQueryData(getGetStoryQueryKey(story.id), updated); client.invalidateQueries({ queryKey: getListStoriesQueryKey() }); client.invalidateQueries({ queryKey: getGetStoryStatsQueryKey() }); setSelectedScene(updated.scenes.length - 1); setCustom(''); } });
  };
  if (storyQuery.isLoading) return <main className="page-main"><div className="skeleton skeleton-line" style={{ width: '30%' }} /><div className="skeleton" style={{ height: 55, width: '65%', margin: '1rem 0 3rem' }} /><div className="skeleton" style={{ height: 300, maxWidth: 730 }} /></main>;
  if (storyQuery.isError || !story) return <main className="page-main"><ErrorState message="That story may have moved to another shelf." onRetry={() => storyQuery.refetch()} /></main>;
  return <main className="page-main"><div className="story-header"><div><div className="eyebrow">{story.genre} · {story.status === 'completed' ? 'A finished tale' : 'An open thread'}</div><h1 className="display" data-testid="text-story-title">{story.title}</h1><div className="story-meta"><span>{story.character.name}, {story.character.role}</span><span>Updated {formatDate(story.updatedAt)}</span></div></div><div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}><button className="btn btn-ghost btn-sm" onClick={() => setRename(true)} data-testid="button-story-rename"><Pencil size={14} /> Rename</button><button className="btn btn-ghost btn-sm" onClick={() => exportStory(story, 'txt')} data-testid="button-export-txt"><Download size={14} /> TXT</button><button className="btn btn-ghost btn-sm" onClick={() => exportStory(story, 'json')} data-testid="button-export-json"><FileJson size={14} /> JSON</button></div></div><div className="story-layout"><article className="reader-column"><div className="scene-nav">{story.scenes.map((scene, index) => <button className={`scene-pill ${index === selectedScene ? 'active' : ''}`} key={scene.id} onClick={() => setSelectedScene(index)} data-testid={`button-scene-${scene.id}`}>Scene {index + 1}</button>)}</div>{currentScene && <><div className="scene-kicker"><span>Chapter {currentScene.chapter}</span><span>/</span><span>{currentScene.chapterTitle}</span></div><h2 className="scene-title" data-testid="text-scene-title">{currentScene.title}</h2><div className="scene-location" data-testid="text-scene-location">{currentScene.location} · {currentScene.mood}</div><div className="narrative" data-testid="text-scene-narrative">{currentScene.narrative}</div><div className="action-panel">{advance.isPending ? <div className="turn-loading" data-testid="status-advancing">The next page is taking shape…</div> : story.status === 'completed' ? <div className="empty-state" style={{ padding: '2rem' }} data-testid="status-completed"><h3>The story rests here.</h3><p>Every decision found its consequence. Return to the library whenever you want to remember.</p></div> : <><div className="eyebrow">What do you do?</div><div className="choice-list">{currentScene.choices.map((choice) => <button className="choice-button" key={choice.id} onClick={() => act(choice.text)} data-testid={`button-choice-${choice.id}`}>{choice.text}<ArrowRight size={14} style={{ float: 'right', marginTop: 3 }} /></button>)}</div><div className="custom-action"><div className="field"><label htmlFor="custom-action">Or write your own action</label><input id="custom-action" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) act(custom.trim()); }} maxLength={1000} placeholder="I ask the lighthouse what it remembers…" data-testid="input-custom-action" /></div><button className="btn btn-primary" onClick={() => act(custom.trim())} disabled={!custom.trim()} data-testid="button-send-action"><Send size={15} /> Send</button></div></>}</div></>}</article><aside className="story-sidebar"><div className="side-block"><div className="side-title">Current objective</div><div className="side-value" data-testid="text-current-objective">{story.state.currentObjective || 'Follow the thread.'}</div></div><div className="side-block"><div className="side-title">At</div><div className="side-value" data-testid="text-current-location">{story.state.currentLocation}</div></div><div className="side-block"><div className="side-title">Inventory</div><div className="tag-list">{(story.state.inventory.length ? story.state.inventory : ['Nothing yet']).map((item, index) => <span className="tag" key={`${item}-${index}`} data-testid={`tag-inventory-${index}`}>{item}</span>)}</div></div><div className="side-block"><div className="side-title">Known characters</div><div className="side-value">{story.state.discoveredCharacters?.length ? story.state.discoveredCharacters.join(', ') : 'No one has shown their face.'}</div></div><div className="side-block"><div className="side-title">Your character</div><div className="side-value"><strong>{story.character.name}</strong><br /><span className="muted">{story.character.ability || story.character.role}</span></div></div></aside></div>{rename && <RenameModal story={story} onClose={() => setRename(false)} onSaved={(updated) => client.setQueryData(getGetStoryQueryKey(story.id), updated)} />}</main>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/library" component={Library} /><Route path="/create" component={Create} /><Route path="/story/:id" component={StoryPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Shell><Router /></Shell><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;