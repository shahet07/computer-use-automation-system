const express = require('express'); const path = require('path'); const fs = require('fs/promises');
const { lookupCapability } = require('./capability'); const { replay } = require('./engine');
function createApp() {
const app = express(); app.use(express.json()); app.use(express.static(path.join(__dirname, '..', 'public')));
const members = { '12345': { name: 'Ada Lovelace', balance: '$1,250.00' }, '67890': { name: 'Grace Hopper', balance: '$88.42' } };
const handoffs = new Map(); const liveSessions = new Map();
app.get('/', (_, res) => res.redirect('/target'));
app.get('/target', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'target.html')));
app.get('/api/member/:id', (req,res) => members[req.params.id] ? res.json(members[req.params.id]) : res.status(404).json({ code:'MEMBER_NOT_FOUND', message:'No member matched that number.' }));
app.post('/api/replay', async (req,res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await replay({ capability: req.body.capability || lookupCapability, inputs: req.body.inputs || {}, baseUrl, evidenceDir: path.join(__dirname, '..', 'evidence'), onHandoff: async h => { const id = `handoff-${Date.now()}`; const { page, browser, ...safe } = h; const record = { id, status:'waiting_for_human', humanActions:[], ...safe }; handoffs.set(id, record); liveSessions.set(id, { page, browser }); return record; } });
  await fs.mkdir(path.join(__dirname, '..', 'evidence'), {recursive:true}); await fs.writeFile(path.join(__dirname, '..', 'evidence', `replay-${Date.now()}.json`), JSON.stringify(result, null, 2)); res.json(result);
});
app.get('/api/handoffs', (_,res) => res.json([...handoffs.values()]));
app.get('/operator/:id', (_,res) => res.sendFile(path.join(__dirname, '..', 'public', 'operator.html')));
app.get('/api/handoffs/:id', async (req,res) => { const h=handoffs.get(req.params.id); const live=liveSessions.get(req.params.id); if (!h) return res.sendStatus(404); if(live){ const image=await live.page.screenshot({encoding:'base64'}); h.preview=`data:image/png;base64,${image}`; h.url=live.page.url(); } res.json(h); });
app.post('/api/handoffs/:id/action', async (req,res) => { const h=handoffs.get(req.params.id), live=liveSessions.get(req.params.id); if(!h||!live) return res.status(404).json({error:'Live session not found'}); const {action,value}=req.body; try { if(action==='fill_member_number') await live.page.getByLabel('Member number').fill(String(value)); else if(action==='click_search') await live.page.getByRole('button',{name:'Search'}).click(); else return res.status(400).json({error:'Unsupported manual action'}); h.humanActions.push({at:new Date().toISOString(),action,value:action==='fill_member_number'?'**redacted**':undefined}); h.status='human_in_control'; res.json(h); } catch(error) { res.status(400).json({error:error.message}); } });
app.post('/api/handoffs/:id/resume', async (req,res) => { const h=handoffs.get(req.params.id), live=liveSessions.get(req.params.id); if (!h||!live) return res.sendStatus(404); try { await live.page.getByText('Member profile',{exact:false}).waitFor({timeout:1000}); const savingsBalance=await live.page.locator('#savings-balance').textContent(); h.status='completed_after_handoff'; h.outputs={savingsBalance}; h.humanActions.push({at:new Date().toISOString(),action:'resume_automation'}); await live.browser.close(); liveSessions.delete(req.params.id); res.json(h); } catch(error) { res.status(409).json({error:'Checkpoint is not satisfied; operator must complete the session before resume.',detail:error.message}); } });
app.get('/api/capability', (_,res) => res.json(lookupCapability));
return app;
}
if (require.main === module) createApp().listen(process.env.PORT || 3000, () => console.log('Open http://localhost:3000'));
module.exports = { createApp };
