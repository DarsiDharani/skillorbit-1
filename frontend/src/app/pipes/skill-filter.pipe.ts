import { Pipe, PipeTransform } from '@angular/core';
import { Skill } from '../dashboards/engineer-dashboard/engineer-dashboard.component';

@Pipe({
  name: 'skillFilter'
})
export class SkillFilterPipe implements PipeTransform {
  transform(items: Skill[] | null, search: string = '', status: string = ''): Skill[] {
    if (!items) return [];
    let filtered = items;
    if (search) {
      filtered = filtered.filter(item => item.skill.toLowerCase().includes(search.toLowerCase()));
    }
    if (status) {
      filtered = filtered.filter(item => item.status === status);
    }
    return filtered;
  }
}
