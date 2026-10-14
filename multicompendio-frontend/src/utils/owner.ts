import { RpgSystem } from '../types/system';

// Nome exibido como proprietário: a pessoa que criou o sistema ou, nos
// sistemas que já vêm com o app, o próprio Multicompêndio.
export function ownerLabel(system: Pick<RpgSystem, 'owner_name' | 'is_preconfigured'>): string {
  if (system.owner_name) return system.owner_name;
  return system.is_preconfigured ? 'Multicompêndio' : '—';
}
