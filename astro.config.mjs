import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function remarkMermaid() {
  return function (tree) {
    function visit(node) {
      if (node.type === 'code' && node.lang === 'mermaid') {
        node.type = 'html';
        const encoded = encodeURIComponent(node.value);
        node.value = `<div class="mermaid" data-content="${encoded}">${node.value}</div>`;
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    }
    visit(tree);
  };
}

export default defineConfig({
  site: 'https://yagomilenio.github.io',
  base: '/synergia-docs/',
  markdown: {
    remarkPlugins: [
      remarkMermaid,
      remarkMath,
    ],
    rehypePlugins: [
      rehypeKatex,
    ],
  },
  integrations: [
    react(),
    starlight({
      title: 'Synergia Docs',
      favicon: '/logo-small.jpg',
      head: [
        {
          tag: 'script',
          attrs: {
            type: 'module',
          },
          content: `
            import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs')
              .then((m) => {
                const mermaid = m.default;
                
                function renderMermaid() {
                  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
                  
                  document.querySelectorAll('.mermaid').forEach(el => {
                    const content = el.getAttribute('data-content');
                    if (content) {
                      el.innerHTML = decodeURIComponent(content);
                      el.removeAttribute('data-processed');
                      el.removeAttribute('id');
                    }
                  });
                  
                  mermaid.initialize({
                    startOnLoad: false,
                    theme: theme === 'light' ? 'default' : 'dark',
                    securityLevel: 'loose',
                    themeVariables: theme === 'light' ? {
                      primaryColor: '#f4f6f8',
                      edgeLabelBackground: '#ffffff',
                    } : {},
                  });
                  
                  mermaid.run({
                    nodes: document.querySelectorAll('.mermaid')
                  }).catch(err => console.error('Error al renderizar Mermaid:', err));
                }

                if (document.readyState === 'loading') {
                  window.addEventListener('DOMContentLoaded', renderMermaid);
                } else {
                  renderMermaid();
                }

                const observer = new MutationObserver((mutations) => {
                  for (const mutation of mutations) {
                    if (mutation.attributeName === 'data-theme') {
                      renderMermaid();
                      break;
                    }
                  }
                });
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
                
                window.addEventListener('astro:page-load', renderMermaid);
              })
              .catch((e) => console.error('Error al cargar Mermaid:', e));
          `
        },
        {
          tag: 'script',
          content: `
            function initCustomTocScrollSpy() {
              let ticking = false;

              const updateToc = () => {
                ticking = false;
                const toc = document.querySelector('starlight-toc');
                if (!toc) return;

                const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
                if (!links.length) return;

                const headings = [];
                links.forEach(link => {
                  const href = link.getAttribute('href') || '';
                  const id = decodeURIComponent(href.replace(/^#/, ''));
                  const el = document.getElementById(id);
                  if (el) {
                    headings.push({ el, link });
                  }
                });

                if (!headings.length) return;

                const scrollY = window.scrollY || window.pageYOffset;
                const viewportHeight = window.innerHeight;
                const scrollHeight = document.documentElement.scrollHeight;
                const maxScroll = scrollHeight - viewportHeight;

                const bottomDistance = maxScroll - scrollY;
                const bottomProximity = maxScroll > 0 ? Math.max(0, Math.min(1, (350 - bottomDistance) / 350)) : 0;
                const activeThreshold = 120 + bottomProximity * (viewportHeight - 240);

                let activeHeading = headings[0];

                for (let i = 0; i < headings.length; i++) {
                  const rect = headings[i].el.getBoundingClientRect();
                  if (rect.top <= activeThreshold) {
                    activeHeading = headings[i];
                  } else {
                    break;
                  }
                }

                if (maxScroll > 0 && scrollY >= maxScroll - 20) {
                  const last = headings[headings.length - 1];
                  const lastRect = last.el.getBoundingClientRect();
                  if (lastRect.top <= viewportHeight - 40) {
                    activeHeading = last;
                  }
                }

                links.forEach(l => {
                  if (l === activeHeading.link) {
                    l.setAttribute('aria-current', 'true');
                  } else {
                    l.removeAttribute('aria-current');
                  }
                });
              };

              const onScroll = () => {
                if (!ticking) {
                  window.requestAnimationFrame(updateToc);
                  ticking = true;
                }
              };

              window.addEventListener('scroll', onScroll, { passive: true });
              window.addEventListener('resize', onScroll, { passive: true });
              updateToc();
            }

            if (document.readyState === 'loading') {
              window.addEventListener('DOMContentLoaded', initCustomTocScrollSpy);
            } else {
              initCustomTocScrollSpy();
            }
            window.addEventListener('astro:page-load', initCustomTocScrollSpy);
          `
        },
        {
          tag: 'script',
          content: `
            function initImageLightbox() {
              let overlay = document.querySelector('.sl-lightbox-overlay');
              if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sl-lightbox-overlay';

                const img = document.createElement('img');
                img.className = 'sl-lightbox-img';
                img.alt = 'Zoomed image';

                overlay.appendChild(img);
                document.body.appendChild(overlay);

                overlay.addEventListener('click', () => {
                  overlay.classList.remove('active');
                });

                window.addEventListener('keydown', (e) => {
                  if (e.key === 'Escape') {
                    overlay.classList.remove('active');
                  }
                });
              }

              const lightboxImg = overlay.querySelector('.sl-lightbox-img');

              document.querySelectorAll('main img, article img').forEach(img => {
                if (img.closest('.site-title') || img.closest('.brand') || img.closest('.logo') || img.closest('.social-icons') || img.classList.contains('sl-lightbox-img')) {
                  return;
                }

                img.style.cursor = 'zoom-in';

                if (!img.dataset.hasLightbox) {
                  img.dataset.hasLightbox = 'true';
                  img.addEventListener('click', (e) => {
                    e.preventDefault();
                    lightboxImg.src = img.src;
                    lightboxImg.alt = img.alt || 'Zoomed image';
                    overlay.classList.add('active');
                  });
                }
              });
            }

            if (document.readyState === 'loading') {
              window.addEventListener('DOMContentLoaded', initImageLightbox);
            } else {
              initImageLightbox();
            }
            window.addEventListener('astro:page-load', initImageLightbox);
          `
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
          },
        }
      ],
      logo: {
        light: './public/logo.jpg',
        dark: './public/logo-dark.jpg',
      },
      social: [
        { label: 'GitHub', href: 'https://github.com/yagomilenio/synergia-server', icon: 'github' },
      ],
      sidebar: [
        {
          label: 'Visión General',
          items: [
            { label: 'Introducción', link: '/docs/introduccion/' },
            { label: '¿Por qué Synergia?', link: '/docs/por-que-synergia/' },
            { label: 'Primeros Pasos', link: '/docs/primeros-pasos/' },
            { label: 'Configuración del Servidor', link: '/docs/configuracion-servidor/' },
            { label: 'Configuración del Cliente', link: '/docs/configuracion-cliente/' },
            { label: 'Caso de Uso Completo', link: '/docs/caso-de-uso/' },
          ],
        },
        {
          label: 'Arquitectura y Flujo',
          items: [
            { label: 'Arquitectura del Sistema', link: '/docs/arquitectura/' },
            { label: 'Patrones de Diseño', link: '/docs/patrones-de-diseno/' },
            { label: 'Flujo de Tareas', link: '/docs/flujo-de-tareas/' },
            { label: 'Internals del Worker', link: '/docs/worker-aislamiento/' },
          ],
        },
        {
          label: 'Especificaciones',
          items: [
            { label: 'Modelo Económico', link: '/docs/modelo-economico/' },
            { label: 'Modelo de Datos', link: '/docs/modelo-de-datos/' },
            { label: 'Seguridad y Autenticación', link: '/docs/seguridad/' },
          ],
        },
        {
          label: 'Referencias Técnicas',
          items: [
            { label: 'Referencia config.toml', link: '/docs/config-toml/' },
            { label: 'Contrato Makefile', link: '/docs/contrato-makefile/' },
            { label: 'Comandos del CLI', link: '/docs/cli/' },
            { label: 'API REST', link: '/docs/api-rest/' },
            { label: 'API WebSocket', link: '/docs/api-websocket/' },
            { label: 'Métricas Prometheus', link: '/docs/metricas/' },
          ],
        },
        {
          label: 'Tareas de Ejemplo',
          items: [
            { label: 'Repositorios Demostrativos', link: '/docs/tareas-ejemplo/' },
          ],
        },
        {
          label: 'Recursos',
          items: [
            { label: 'Glosario', link: '/docs/glosario/' },
            { label: 'Roadmap', link: '/docs/roadmap/' },
          ],
        },
      ],
      customCss: [
        './src/styles/starlight-custom.css',
      ],
    }),
  ],
});
