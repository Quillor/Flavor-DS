import { TEMPLATES } from './product/productNav';
import { COMPONENT_GROUPS, docsByGroup } from './core/componentDocs';

export interface NavItem { label: string; href: string; children?: NavGroup[] }
export interface NavGroup { group: string; items: NavItem[] }

export const siteNav: NavGroup[] = [
  {
    group: 'Getting started',
    items: [
      { label: 'Home', href: '/' },
      { label: 'MCP Import', href: '/mcp/' },
      { label: 'Agent Ready', href: '/agent-ready/' },
      { label: 'Workflow', href: '/workflow/' },
      { label: 'Canvas demo', href: '/canvas-demo/' },
    ],
  },
  {
    group: 'Brand',
    items: [{ label: 'Brand overview', href: '/brand/' }],
  },
  {
    group: 'Core UI',
    items: [
      { label: 'Overview', href: '/core/' },
      { label: 'Color & Contrast', href: '/core/colors/' },
      { label: 'Tokens', href: '/core/tokens/' },
      { label: 'Icons', href: '/core/icons/' },
      { label: 'Illustrations & Photos', href: '/core/assets/' },
      {
        label: 'Components',
        href: '/core/components/',
        children: COMPONENT_GROUPS.map((g) => ({
          group: g,
          items: docsByGroup(g).map((d) => ({ label: d.title, href: `/core/components/${d.id}/` })),
        })),
      },
    ],
  },
  {
    group: 'Product',
    items: [
      { label: 'Overview', href: '/product/' },
      ...TEMPLATES.map((t) => ({ label: t.label, href: `/product/${t.slug}/` })),
    ],
  },
  {
    group: 'Marketing',
    items: [{ label: 'Social formats', href: '/marketing/' }],
  },
];
