const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();
const SOURCE_DIR = '/root/ProjectList/agent-testing/landing-pages';
const ITERATIONS_DIR = path.join(__dirname, '..', '..', 'data', 'iterations');

// Map folder names to agent names and project groups
function parseLandingPageDir(dirName) {
  // Pattern: agent-name or agent-name-v2
  const match = dirName.match(/^(.+?)(?:-(v\d+[a-z]?))?$/);
  if (!match) return null;

  const baseName = match[1];
  const versionStr = match[2] || 'v1';

  // Map base names to actual agent names
  const agentMap = {
    'brutalist-raw': 'brutalist-raw',
    'cyberpunk-terminal': 'cyberpunk-terminal',
    'dark-luxury': 'dark-luxury',
    'editorial-magazine': 'editorial-magazine',
    'epiminds-dark': 'epiminds-site-architect',
    'glassmorphism-aurora': 'glassmorphism-aurora',
    'organic-earth': 'organic-earth',
    'pop-bento': 'pop-bento-builder',
  };

  const agentName = agentMap[baseName] || baseName;
  const version = parseInt(versionStr.replace(/[^0-9]/g, '')) || 1;
  const versionSuffix = versionStr.replace(/^v\d+/, '');

  return {
    dirName,
    baseName,
    agentName,
    version,
    versionSuffix,
    projectName: baseName,
  };
}

// POST /api/seed — import existing landing pages
router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(SOURCE_DIR)) {
      return res.status(404).json({ error: 'Source directory not found: ' + SOURCE_DIR });
    }

    const dirs = fs.readdirSync(SOURCE_DIR)
      .filter(d => {
        const stat = fs.statSync(path.join(SOURCE_DIR, d));
        return stat.isDirectory() && fs.existsSync(path.join(SOURCE_DIR, d, 'index.html'));
      });

    // Group by project
    const projectGroups = {};
    for (const dir of dirs) {
      const parsed = parseLandingPageDir(dir);
      if (!parsed) continue;

      if (!projectGroups[parsed.projectName]) {
        projectGroups[parsed.projectName] = {
          agentName: parsed.agentName,
          iterations: [],
        };
      }
      projectGroups[parsed.projectName].iterations.push(parsed);
    }

    const results = { projects: 0, iterations: 0 };

    for (const [projectName, group] of Object.entries(projectGroups)) {
      // Create project
      const projectId = crypto.randomUUID();
      const displayName = projectName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      await db.createProject(projectId, displayName, `Landing page tests with ${group.agentName} agent`, group.agentName);
      results.projects++;

      // Sort iterations by version
      const sorted = group.iterations.sort((a, b) => {
        if (a.version !== b.version) return a.version - b.version;
        return a.versionSuffix.localeCompare(b.versionSuffix);
      });

      let prevId = null;
      let versionCounter = 1;

      for (const iter of sorted) {
        const iterationId = crypto.randomUUID();
        const sourcePath = path.join(SOURCE_DIR, iter.dirName, 'index.html');

        // Copy HTML + images to iterations dir
        const targetDir = path.join(ITERATIONS_DIR, projectId, iterationId);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(sourcePath, path.join(targetDir, 'index.html'));

        // Copy images/ directory if it exists
        const sourceImagesDir = path.join(SOURCE_DIR, iter.dirName, 'images');
        if (fs.existsSync(sourceImagesDir)) {
          const targetImagesDir = path.join(targetDir, 'images');
          fs.mkdirSync(targetImagesDir, { recursive: true });
          for (const img of fs.readdirSync(sourceImagesDir)) {
            fs.copyFileSync(path.join(sourceImagesDir, img), path.join(targetImagesDir, img));
          }
        }

        const filePath = `${projectId}/${iterationId}/index.html`;
        const title = iter.versionSuffix
          ? `V${iter.version}${iter.versionSuffix}`
          : `V${iter.version}`;

        // Check if this is a branch (e.g., v4a, v4b are siblings of v3 or v4)
        let parentId = prevId;
        if (iter.versionSuffix && versionCounter > 1) {
          // Branch variants share the same parent as the first in this version group
          const sameVersionSiblings = sorted.filter(s =>
            s.version === iter.version && s !== iter && !s.versionSuffix
          );
          if (sameVersionSiblings.length > 0) {
            // Use the previous non-branched iteration as parent
          }
        }

        await db.createIteration(
          iterationId, projectId, iter.agentName, versionCounter,
          title, `Iteration ${title} of ${displayName}`,
          parentId, filePath, '', 'completed', { source: iter.dirName }
        );

        prevId = iterationId;
        versionCounter++;
        results.iterations++;
      }

      // Update project iteration count
      await db.updateProjectIterationCount(projectId, versionCounter - 1);
    }

    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/seed/status — check if seed data exists
router.get('/status', async (req, res) => {
  try {
    const projects = await db.getAllProjects();
    res.json({ seeded: projects.length > 0, projectCount: projects.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/seed/demo — seed demo agents + skills (idempotent)
router.post('/demo', async (req, res) => {
  try {
    const demoAgents = [
      {
        name: 'landing-page-builder',
        description: 'Creates modern, responsive landing pages with conversion-focused layouts',
        model: 'sonnet',
        category: 'builders',
        prompt: `# Landing Page Builder

You are an expert landing page designer and developer. Your role is to create modern, responsive, conversion-focused landing pages.

## Core Principles
- Mobile-first responsive design
- Clear visual hierarchy with compelling CTAs
- Fast-loading, semantic HTML5
- Accessibility (WCAG 2.1 AA)
- SEO-friendly structure

## Design Patterns
- Hero section with strong headline + subtext + CTA
- Social proof / testimonials section
- Feature grid with icons
- Pricing comparison tables
- FAQ accordion section
- Footer with links and newsletter signup

## Technical Requirements
- Self-contained HTML with inlined CSS and JS
- Use CSS Grid and Flexbox for layouts
- Smooth scroll animations with IntersectionObserver
- CSS custom properties for theming
- Use Unsplash for placeholder images
- Optimize for Core Web Vitals

Always output a single index.html file.`,
      },
      {
        name: 'api-architect',
        description: 'Designs RESTful APIs with validation, error handling, and OpenAPI docs',
        model: 'sonnet',
        category: 'dev-tools',
        prompt: `# API Architect

You are a senior API architect specializing in RESTful API design and documentation.

## Core Responsibilities
- Design clean, consistent REST endpoints
- Define request/response schemas with validation
- Error handling with proper HTTP status codes
- Authentication and authorization patterns
- Rate limiting and pagination strategies

## Design Principles
- Resource-oriented URLs (nouns, not verbs)
- Consistent naming conventions (kebab-case)
- Proper use of HTTP methods (GET, POST, PUT, PATCH, DELETE)
- HATEOAS where appropriate
- Versioning strategy (URL path or headers)

## Output Format
- OpenAPI 3.0 specification
- Example request/response payloads
- Error response catalog
- Authentication flow diagrams
- Database schema suggestions

Always prioritize developer experience and API consistency.`,
      },
      {
        name: 'ui-stylist',
        description: 'Transforms HTML into stunning interfaces with animations and micro-interactions',
        model: 'sonnet',
        category: 'design',
        prompt: `# UI Stylist

You are a UI/UX designer specializing in visual polish, animations, and micro-interactions.

## Expertise Areas
- CSS animations and transitions
- Micro-interactions (hover, focus, click feedback)
- Color theory and palette generation
- Typography pairing and hierarchy
- Glassmorphism, neumorphism, and modern effects

## Animation Toolkit
- Entrance animations (fade, slide, scale)
- Scroll-triggered reveals with IntersectionObserver
- Smooth state transitions
- Loading skeletons and spinners
- Parallax and depth effects

## Design Systems
- CSS custom properties for tokens
- Consistent spacing scale (4px grid)
- Border radius and shadow systems
- Dark/light mode support
- Responsive breakpoint strategy

## Technical Standards
- 60fps animations (use transform/opacity)
- Reduced motion media query support
- No layout thrashing
- GPU-accelerated properties only

Transform any plain HTML into a visually stunning experience.`,
      },
      {
        name: 'code-reviewer',
        description: 'Thorough code reviews for security, performance, and best practices',
        model: 'opus',
        category: 'dev-tools',
        prompt: `# Code Reviewer

You are a senior code reviewer with expertise in security, performance, and software engineering best practices.

## Review Checklist

### Security
- Input validation and sanitization
- SQL injection, XSS, CSRF prevention
- Authentication/authorization checks
- Secrets management (no hardcoded keys)
- Dependency vulnerability assessment

### Performance
- Algorithm complexity analysis
- Memory leak detection
- N+1 query detection
- Unnecessary re-renders (React)
- Bundle size impact

### Code Quality
- SOLID principles adherence
- DRY without over-abstraction
- Error handling completeness
- Edge case coverage
- Naming conventions and readability

### Testing
- Test coverage gaps
- Missing edge case tests
- Test isolation and reliability
- Mock/stub appropriateness

## Output Format
Provide feedback as:
- CRITICAL: Must fix before merge
- WARNING: Should fix, potential issues
- SUGGESTION: Nice to have improvements
- PRAISE: Good patterns to highlight

Be constructive, specific, and provide code examples for fixes.`,
      },
    ];

    const demoSkills = [
      {
        name: 'SEO Optimization',
        description: 'Meta tags, structured data, Open Graph, accessibility',
        category: 'seo',
        color: '#3B82F6',
        prompt: `# SEO Optimization Skill

## Meta Tags
- Generate proper title tags (50-60 chars)
- Write meta descriptions (150-160 chars)
- Add canonical URLs
- Set viewport and charset

## Open Graph / Social
- og:title, og:description, og:image
- Twitter card meta tags
- Structured data (JSON-LD)

## Accessibility
- Semantic HTML elements
- ARIA labels where needed
- Alt text for all images
- Proper heading hierarchy (h1 > h2 > h3)
- Focus management and keyboard nav

## Technical SEO
- Clean URL structure
- Internal linking strategy
- Image optimization (lazy loading, srcset)
- Performance hints (preconnect, prefetch)

Always validate with schema.org guidelines.`,
      },
      {
        name: 'Dark Mode Support',
        description: 'Dark/light toggle with CSS custom properties',
        category: 'design',
        color: '#6366F1',
        prompt: `# Dark Mode Support Skill

## Implementation
- CSS custom properties for all colors
- prefers-color-scheme media query
- JavaScript toggle with localStorage persistence
- Smooth transition between modes

## Color System
\`\`\`css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #111111;
  --text-secondary: #666666;
  --border: rgba(0,0,0,0.1);
}
[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --text-primary: #f4f4f5;
  --text-secondary: #a1a1aa;
  --border: rgba(255,255,255,0.08);
}
\`\`\`

## Toggle Component
- Sun/moon icon toggle
- Respect system preference on first visit
- Save preference to localStorage
- No flash of wrong theme (FOUC prevention)

Apply consistently across all components.`,
      },
      {
        name: 'Form Validation',
        description: 'Client + server validation with accessible errors',
        category: 'dev-tools',
        color: '#10B981',
        prompt: `# Form Validation Skill

## Client-Side Validation
- Real-time field validation on blur
- Pattern matching with clear regex
- Required field indicators
- Character count limits
- Email, URL, phone format checks

## Error Display
- Inline error messages below fields
- Red border on invalid fields
- Error summary at form top
- aria-describedby linking errors to fields
- aria-invalid attribute management

## UX Patterns
- Don't validate on first focus
- Validate on blur, re-validate on input
- Disable submit until valid
- Loading state during submission
- Success feedback after submit

## Common Validators
- Email: RFC 5322 compliant
- Password: min 8 chars, mixed case, number
- Phone: international format support
- URL: with/without protocol
- Date: range and format checks

Always pair client validation with server-side checks.`,
      },
      {
        name: 'Performance Audit',
        description: 'Page load, image compression, lazy loading, caching',
        category: 'dev-tools',
        color: '#F59E0B',
        prompt: `# Performance Audit Skill

## Core Web Vitals
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1

## Image Optimization
- Modern formats (WebP, AVIF)
- Responsive srcset with sizes
- Lazy loading with loading="lazy"
- Width/height attributes to prevent CLS
- Blur-up placeholder technique

## Loading Strategy
- Critical CSS inlining
- Async/defer for non-critical JS
- Resource hints (preload, prefetch, preconnect)
- Font display: swap
- Code splitting and tree shaking

## Caching
- Cache-Control headers
- Service Worker for offline support
- CDN configuration
- ETag and conditional requests

## Audit Checklist
- Run Lighthouse performance audit
- Check network waterfall
- Identify render-blocking resources
- Measure Time to Interactive
- Profile JavaScript execution

Target: 90+ Lighthouse performance score.`,
      },
    ];

    let agentsCreated = 0;
    let skillsCreated = 0;

    // Seed demo agents (idempotent — skip if exists)
    for (const a of demoAgents) {
      const existing = await db.getAgent(a.name);
      if (!existing) {
        const promptPreview = a.prompt.substring(0, 500);
        await db.upsertAgent(
          a.name, a.description, a.model, a.category,
          promptPreview, '', 0, a.prompt, 'filesystem',
          '', 0, '', ''
        );
        agentsCreated++;
      }
    }

    // Seed demo skills (idempotent — skip if slug exists)
    for (const s of demoSkills) {
      const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await db.getSkillBySlug(slug);
      if (!existing) {
        await db.createSkill(s.name, slug, s.description, s.prompt, s.category, '', s.color, null);
        skillsCreated++;
      }
    }

    res.json({ ok: true, agentsCreated, skillsCreated });
  } catch (err) {
    console.error('[Seed] Demo error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
