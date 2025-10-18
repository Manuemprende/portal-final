// src/components/CountryPicker.tsx
import React, { useEffect, useState } from 'react';
import { fetchCountries, CountryRow } from '../services/countries';

type Props = {
  value?: string;                       // ISO-2 (ej: 'CL')
  onChange?: (code: string) => void;
};

const CountryPicker: React.FC<Props> = ({ value = 'CL', onChange }) => {
  const [items, setItems] = useState<CountryRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => setItems(await fetchCountries()))();
  }, []);

  const current = items.find(i => i.code === value);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title={current?.name ?? 'País'}>
        {current ? <img src={current.flag_url} alt={current.name} /> : '🌐'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0,
          background: 'white', borderRadius: 12, padding: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,.12)', maxHeight: 420, overflow: 'auto'
        }}>
          {items.map(c => (
            <button
              key={c.code}
              onClick={() => { onChange?.(c.code); setOpen(false); }}
              title={c.name}
              style={{ display: 'block', width: 48, height: 36, border: 'none', background: 'transparent', margin: 6, cursor: 'pointer' }}
            >
              <img src={c.flag_url} alt={c.name} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountryPicker;
