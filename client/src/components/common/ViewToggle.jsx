import { Headset, MessageCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const options = [
  { to: '/customer', label: 'Customer', icon: MessageCircle },
  { to: '/agent', label: 'Agent', icon: Headset },
];

export function ViewToggle() {
  return (
    <nav aria-label="Switch view" className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {options.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
