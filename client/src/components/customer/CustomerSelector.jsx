import { Check, UserRound } from 'lucide-react';
import { useState } from 'react';
import { TEST_CUSTOMERS } from '../../utils/constants.js';
import { initials } from '../../utils/format.js';
import { Alert } from '../common/Alert.jsx';
import { Button } from '../common/Button.jsx';

const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const samePhone = (a = '', b = '') => a.replace(/[\s-]/g, '') === b.replace(/[\s-]/g, '');

export function CustomerSelector({ current, onSelect, busy }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) return setFormError('Please enter a name.');
    if (!PHONE_PATTERN.test(phone.trim())) return setFormError('Please enter a valid phone number, e.g. +919800000009.');
    setFormError('');
    onSelect({ name: name.trim(), phone: phone.trim() });
  }

  return (
    <div className="space-y-5">
      {TEST_CUSTOMERS.length > 0 && (
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">Test customers</h2>
        <ul className="space-y-1.5">
          {TEST_CUSTOMERS.map((customer) => {
            const active = samePhone(current?.phone, customer.phone);
            return (
              <li key={customer.phone}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(customer)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                    active ? 'border-brand-600 bg-brand-50' : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                    {initials(customer.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{customer.name}</span>
                    <span className="block text-xs text-stone-500">{customer.phone}</span>
                  </span>
                  {active && <Check className="size-4 text-brand-700" aria-label="Selected" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          {TEST_CUSTOMERS.length > 0 ? 'Or enter your details' : 'Enter your details'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-2" noValidate>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            maxLength={100}
            aria-label="Full name"
            className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone, e.g. +919800000009"
            inputMode="tel"
            maxLength={25}
            aria-label="Phone number"
            className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <Alert type="error">{formError}</Alert>
          <Button type="submit" variant="secondary" icon={UserRound} loading={busy} className="w-full">
            Continue as this customer
          </Button>
        </form>
      </section>
    </div>
  );
}
