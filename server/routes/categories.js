const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// GET /api/categories — list all categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.getAllCategories();
    res.json(categories);
  } catch (err) {
    console.error('[Categories] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/categories/:id — get single category
router.get('/:id', async (req, res) => {
  try {
    const cat = await db.getCategory(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/categories — create category
router.post('/', async (req, res) => {
  try {
    const { name, color, icon, description, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const existing = await db.getCategoryByName(name.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'Category already exists' });

    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    await db.createCategory(id, name.trim().toLowerCase(), color, icon, description, sort_order);
    const created = await db.getCategory(id);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Categories] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/categories/reorder — reorder categories (must be before /:id)
router.put('/reorder', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
    await db.reorderCategories(ids);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Categories] Reorder error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/categories/:id — update category
router.put('/:id', async (req, res) => {
  try {
    const cat = await db.getCategory(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const { name, color, icon, description, sort_order } = req.body;
    await db.updateCategory(
      req.params.id,
      (name || cat.name).trim().toLowerCase(),
      color || cat.color,
      icon !== undefined ? icon : cat.icon,
      description !== undefined ? description : cat.description,
      sort_order !== undefined ? sort_order : cat.sort_order
    );
    res.json(await db.getCategory(req.params.id));
  } catch (err) {
    console.error('[Categories] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/categories/:id — delete category
router.delete('/:id', async (req, res) => {
  try {
    const cat = await db.getCategory(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    await db.deleteCategory(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Categories] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
