const express = require('express'); const path = require('path'); const fs = require('fs/promises');
const { lookupCapability } = require('./capability'); const { replay } = require('./engine');
function createApp() {
const app = express(); app.use(express.json()); app.use(express.static(path.join(__dirname, '..', 'public')));
const members = { '12345': { name: 'Ada Lovelace', balance: '$1,250.00' }, '67890': { name: 'Grace Hopper', balance: '$88.42' } };
const handoffs = new Map();
app.get('/', (_, res) => res.redirect('/target'));
app.get('/target', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'target.html')));
app.get('/api/member/:id', (req,res) => members[req.params.id] ? res.json(members[req.params.id]) : res.status(404).json({ code:'MEMBER_NOT_FOUND', message:'No member matched that number.' }));
app.post('/api/replay', async (req,res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await replay({ capability: req.body.capability || lookupCapability, inputs: req.body.inputs || {}, baseUrl, evidenceDir: path.join(__dirname, '..', 'evidence'), onHandoff: async h => { const id = `handoff-${Date.now()}`; handoffs.set(id, { id, status:'waiting_for_human', ...h }); } });
  await fs.mkdir(path.join(__dirname, '..', 'evidence'), {recursive:true}); await fs.writeFile(path.join(__dirname, '..', 'evidence', `replay-${Date.now()}.json`), JSON.stringify(result, null, 2)); res.json(result);
});
app.get('/api/handoffs', (_,res) => res.json([...handoffs.values()]));
app.post('/api/handoffs/:id/resume', (req,res) => { const h=handoffs.get(req.params.id); if (!h) return res.sendStatus(404); h.status='resumed'; h.humanActions=req.body.actions || []; res.json(h); });
app.get('/api/capability', (_,res) => res.json(lookupCapability));
return app;
}
if (require.main === module) createApp().listen(process.env.PORT || 3000, () => console.log('Open http://localhost:3000'));
module.exports = { createApp };
