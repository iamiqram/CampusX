import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Handshake,
  MapPin,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Upload,
  Users
} from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const modules = [
  { id: 'lost', label: 'Lost & Found', icon: PackageSearch },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'squads', label: 'Study Squads', icon: Users },
  { id: 'market', label: 'Marketplace', icon: ShoppingBag },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'gpa', label: 'GPA', icon: GraduationCap }
];

function App() {
  const [active, setActive] = useState('lost');
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/dashboard`);
      if (!res.ok) throw new Error('Could not load campus feed');
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      ['Open finds', data.lostItems.filter((item) => item.status === 'open').length],
      ['Notes shared', data.notes.length],
      ['Squads forming', data.studySquads.length],
      ['Event RSVPs', data.events.reduce((sum, event) => sum + event.rsvp_count, 0)]
    ];
  }, [data]);

  const ActiveIcon = modules.find((module) => module.id === active)?.icon || Sparkles;

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">CX</div>
          <div>
            <strong>CampusX</strong>
            <span>Everything social for your college</span>
          </div>
        </div>
        <div className="search-shell">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subject, item, event, place..." />
        </div>
        <button className="icon-button" onClick={refresh} title="Refresh campus data">
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p>Campus-only exchange board</p>
          <h1>Find people, notes, gear, events, and your likely semester outcome.</h1>
        </div>
        <div className="hero-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <nav className="module-tabs" aria-label="Campus modules">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button key={module.id} className={active === module.id ? 'active' : ''} onClick={() => setActive(module.id)}>
              <Icon size={18} />
              <span>{module.label}</span>
            </button>
          );
        })}
      </nav>

      {error && <p className="alert">{error}</p>}
      {loading || !data ? (
        <section className="loading">Loading live campus data...</section>
      ) : (
        <section className="workspace">
          <div className="section-title">
            <ActiveIcon size={22} />
            <h2>{modules.find((module) => module.id === active)?.label}</h2>
          </div>
          {active === 'lost' && <LostFound items={filter(data.lostItems, query)} onChange={refresh} />}
          {active === 'notes' && <Notes items={filter(data.notes, query)} onChange={refresh} />}
          {active === 'squads' && <StudySquads items={filter(data.studySquads, query)} onChange={refresh} />}
          {active === 'market' && <Marketplace items={filter(data.marketplaceItems, query)} onChange={refresh} />}
          {active === 'events' && <Events items={filter(data.events, query)} onChange={refresh} />}
          {active === 'gpa' && <Gpa items={data.gpaPredictions} onChange={refresh} />}
        </section>
      )}
    </main>
  );
}

function filter(items, query) {
  if (!query.trim()) return items;
  const needle = query.toLowerCase();
  return items.filter((item) => Object.values(item).join(' ').toLowerCase().includes(needle));
}

async function submitForm(event, endpoint, onChange) {
  event.preventDefault();
  const form = event.currentTarget;
  const hasFiles = [...form.elements].some((element) => element.type === 'file' && element.files?.length);
  const body = hasFiles ? new FormData(form) : Object.fromEntries(new FormData(form));
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    body: hasFiles ? body : JSON.stringify(body),
    headers: hasFiles ? undefined : { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || 'Save failed');
  }
  form.reset();
  onChange();
}

function useSubmit(endpoint, onChange) {
  const [message, setMessage] = useState('');
  return {
    message,
    onSubmit: async (event) => {
      setMessage('');
      try {
        await submitForm(event, endpoint, onChange);
        setMessage('Saved');
      } catch (err) {
        setMessage(err.message);
      }
    }
  };
}

function LostFound({ items, onChange }) {
  const submit = useSubmit('/api/lost-items', onChange);
  const claim = async (id) => {
    await fetch(`${API}/api/lost-items/${id}/claim`, { method: 'PATCH' });
    onChange();
  };
  return (
    <TwoColumn>
      <Panel title="Post a lost or found item" icon={Plus} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="title" placeholder="Item name" />
          <Input name="location" placeholder="Last seen / found location" />
          <Textarea name="description" placeholder="Details that help identify it" />
          <Input name="contact" placeholder="Campus email or phone" />
          <File name="photo" label="Photo" />
          <button><Upload size={17} /> Post item</button>
        </form>
      </Panel>
      <CardGrid>
        {items.map((item) => (
          <article className="card" key={item.id}>
            <Media src={item.photo_url} label={item.title} />
            <div className="card-body">
              <Badge tone={item.status === 'open' ? 'green' : 'gray'}>{item.status}</Badge>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Meta icon={MapPin}>{item.location}</Meta>
              <Meta icon={Handshake}>{item.contact}</Meta>
              {item.status === 'open' && <button className="secondary" onClick={() => claim(item.id)}><Check size={16} /> Claim</button>}
            </div>
          </article>
        ))}
      </CardGrid>
    </TwoColumn>
  );
}

function Notes({ items, onChange }) {
  const submit = useSubmit('/api/notes', onChange);
  return (
    <TwoColumn>
      <Panel title="Share notes" icon={BookOpen} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="title" placeholder="Notes title" />
          <Input name="subject" placeholder="Subject" />
          <Select name="note_type" options={['PDF', 'Handwritten', 'Question bank', 'Lab record']} />
          <Textarea name="description" placeholder="What is inside?" />
          <Input name="exchange_for" placeholder="Exchange for / price / free" />
          <Input name="contact" placeholder="Contact" />
          <File name="file" label="Upload PDF or image" />
          <button><Upload size={17} /> Share notes</button>
        </form>
      </Panel>
      <List>
        {items.map((item) => (
          <article className="list-item" key={item.id}>
            <Badge>{item.note_type}</Badge>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="inline-meta">
              <span>{item.subject}</span>
              <span>{item.exchange_for}</span>
              <span>{item.contact}</span>
            </div>
            {item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer">Open file</a>}
          </article>
        ))}
      </List>
    </TwoColumn>
  );
}

function StudySquads({ items, onChange }) {
  const submit = useSubmit('/api/study-squads', onChange);
  return (
    <TwoColumn>
      <Panel title="Find a study squad" icon={Users} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="subject" placeholder="Subject" />
          <Input name="year" placeholder="Batch / year" />
          <Input name="availability" placeholder="Availability" />
          <Select name="style" options={['Problem-solving sprints', 'Quiet revision', 'Teach-back', 'Past-paper practice']} />
          <Textarea name="goals" placeholder="What should the group achieve?" />
          <Input name="contact" placeholder="Contact" />
          <button><Plus size={17} /> Create match post</button>
        </form>
      </Panel>
      <CardGrid compact>
        {items.map((item) => (
          <article className="card text-card" key={item.id}>
            <div className="card-body">
              <Badge>{item.year}</Badge>
              <h3>{item.subject}</h3>
              <p>{item.goals}</p>
              <Meta icon={CalendarDays}>{item.availability}</Meta>
              <Meta icon={Sparkles}>{item.style}</Meta>
              <Meta icon={Handshake}>{item.contact}</Meta>
            </div>
          </article>
        ))}
      </CardGrid>
    </TwoColumn>
  );
}

function Marketplace({ items, onChange }) {
  const submit = useSubmit('/api/marketplace', onChange);
  return (
    <TwoColumn>
      <Panel title="Sell campus gear" icon={ShoppingBag} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="title" placeholder="Item title" />
          <Select name="category" options={['Textbook', 'Calculator', 'Lab gear', 'Hostel item', 'Electronics']} />
          <Input name="price" type="number" placeholder="Price in rupees" />
          <Select name="item_condition" options={['Like new', 'Good', 'Used', 'Needs repair']} />
          <Textarea name="description" placeholder="Condition and pickup details" />
          <Input name="contact" placeholder="Contact" />
          <File name="photo" label="Photo" />
          <button><Upload size={17} /> List item</button>
        </form>
      </Panel>
      <CardGrid>
        {items.map((item) => (
          <article className="card" key={item.id}>
            <Media src={item.photo_url} label={item.title} />
            <div className="card-body">
              <Badge>{item.category}</Badge>
              <h3>{item.title}</h3>
              <strong className="price">Rs {item.price}</strong>
              <p>{item.description}</p>
              <div className="inline-meta">
                <span>{item.item_condition}</span>
                <span>{item.contact}</span>
              </div>
            </div>
          </article>
        ))}
      </CardGrid>
    </TwoColumn>
  );
}

function Events({ items, onChange }) {
  const submit = useSubmit('/api/events', onChange);
  const rsvp = async (id) => {
    await fetch(`${API}/api/events/${id}/rsvp`, { method: 'POST' });
    onChange();
  };
  return (
    <TwoColumn>
      <Panel title="Post an event" icon={CalendarDays} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="title" placeholder="Event title" />
          <Input name="host" placeholder="Club / host" />
          <Input name="event_date" type="datetime-local" />
          <Input name="location" placeholder="Venue" />
          <Textarea name="description" placeholder="What is happening?" />
          <button><Plus size={17} /> Publish event</button>
        </form>
      </Panel>
      <List>
        {items.map((item) => (
          <article className="event-item" key={item.id}>
            <div className="date-tile">
              <strong>{new Date(item.event_date).getDate()}</strong>
              <span>{new Date(item.event_date).toLocaleString(undefined, { month: 'short' })}</span>
            </div>
            <div>
              <Badge>{item.host}</Badge>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="inline-meta">
                <span>{new Date(item.event_date).toLocaleString()}</span>
                <span>{item.location}</span>
                <span>{item.rsvp_count} going</span>
              </div>
            </div>
            <button className="secondary" onClick={() => rsvp(item.id)}><Check size={16} /> RSVP</button>
          </article>
        ))}
      </List>
    </TwoColumn>
  );
}

function Gpa({ items, onChange }) {
  const submit = useSubmit('/api/gpa-predictions', onChange);
  const latest = items[0];
  return (
    <TwoColumn>
      <Panel title="Predict semester outcome" icon={GraduationCap} message={submit.message}>
        <form onSubmit={submit.onSubmit}>
          <Input name="subject" placeholder="Subject" />
          <Input name="marks" type="number" min="0" max="100" placeholder="Marks %" />
          <Input name="attendance" type="number" min="0" max="100" placeholder="Attendance %" />
          <Input name="assignments" type="number" min="0" max="100" placeholder="Assignment score %" />
          <button><Sparkles size={17} /> Predict and save</button>
        </form>
      </Panel>
      <div className="prediction-shell">
        <div className="prediction">
          <span>Latest prediction</span>
          <strong>{latest ? latest.predicted_grade : '-'}</strong>
          <p>{latest ? `${latest.subject}: ${latest.predicted_points}/10 grade points` : 'Save a subject prediction to see it here.'}</p>
        </div>
        <List>
          {items.map((item) => (
            <article className="list-item compact-row" key={item.id}>
              <h3>{item.subject}</h3>
              <div className="inline-meta">
                <span>Marks {item.marks}%</span>
                <span>Attendance {item.attendance}%</span>
                <span>Assignments {item.assignments}%</span>
                <span>{item.predicted_grade} / {item.predicted_points}</span>
              </div>
            </article>
          ))}
        </List>
      </div>
    </TwoColumn>
  );
}

function TwoColumn({ children }) {
  return <div className="two-column">{children}</div>;
}

function Panel({ title, icon: Icon, message, children }) {
  return (
    <aside className="panel">
      <div className="panel-heading">
        <Icon size={19} />
        <h3>{title}</h3>
      </div>
      {children}
      {message && <p className="form-message">{message}</p>}
    </aside>
  );
}

function CardGrid({ children, compact }) {
  return <div className={compact ? 'card-grid compact-grid' : 'card-grid'}>{children}</div>;
}

function List({ children }) {
  return <div className="list">{children}</div>;
}

function Input(props) {
  return <input required {...props} />;
}

function Textarea(props) {
  return <textarea required rows="4" {...props} />;
}

function Select({ name, options }) {
  return (
    <select name={name} required defaultValue="">
      <option value="" disabled>Select {name.replaceAll('_', ' ')}</option>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function File({ name, label }) {
  return (
    <label className="file-input">
      <Upload size={17} />
      <span>{label}</span>
      <input name={name} type="file" />
    </label>
  );
}

function Badge({ children, tone }) {
  return <span className={`badge ${tone || ''}`}>{children}</span>;
}

function Meta({ icon: Icon, children }) {
  return <span className="meta"><Icon size={15} /> {children}</span>;
}

function Media({ src, label }) {
  return src ? <img className="media" src={src} alt={label} /> : <div className="media placeholder"><PackageSearch size={28} /></div>;
}

createRoot(document.getElementById('root')).render(<App />);
