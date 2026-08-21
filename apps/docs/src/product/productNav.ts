export const TEMPLATES = [
  { slug: 'sign-in', label: 'Sign in' },
  { slug: 'feed', label: 'Social feed' },
  { slug: 'dashboard', label: 'Admin dashboard' },
  { slug: 'canvas', label: 'Canvas / flow builder' },
  { slug: 'chat', label: 'Chat' },
  { slug: 'ai-chat', label: 'AI chat' },
  { slug: 'projects', label: 'Project management' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'map', label: 'Map' },
  { slug: 'music', label: 'Music player' },
  { slug: 'reader', label: 'Audiobook reader' },
  { slug: 'email', label: 'Email client' },
  { slug: 'ecommerce', label: 'E-commerce' },
  { slug: 'image-gallery', label: 'Image gallery' },
  { slug: 'video-gallery', label: 'Video gallery' },
  { slug: 'landing', label: 'Landing page' },
  { slug: 'email-marketing', label: 'HTML email · Marketing' },
  { slug: 'email-notification', label: 'HTML email · Notification' },
  { slug: 'checkout', label: 'Checkout' },
  { slug: 'settings', label: 'Settings' },
];

export const productNav = [
  { group: 'Product DS', items: [{ label: 'Overview', href: '/product/' }, { label: 'Native (iOS · Android)', href: '/product/native/' }] },
  {
    group: 'Templates',
    items: TEMPLATES.map((t) => ({ label: t.label, href: `/product/${t.slug}/` })),
  },
];
