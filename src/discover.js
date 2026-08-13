/* Live LLM discovery: model observes a real browser surface and chooses one bounded action per turn. */
const OpenAI = require('openai'); const { chromium } = require('playwright'); const fs=require('fs/promises'); const path=require('path');
const { lookupCapability } = require('./capability'); const { createApp } = require('./server'); const { redact }=require('./engine');
const policy={allowedActions:['fill','click','done'],allowedLabels:['Member number'],allowedButtons:['Search'],maxSteps:6};
async function discover({goal,baseUrl,evidenceDir}) {
 if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for a genuine discovery run.');
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY}); const browser=await chromium.launch({headless:true}); const page=await browser.newPage(); const events=[];
 try { await page.goto(new URL('/target',baseUrl).href); for(let i=0;i<policy.maxSteps;i++){
   const state=await page.locator('body').innerText(); const response=await client.chat.completions.create({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',response_format:{type:'json_object'},messages:[{role:'system',content:`You control a read-only local member inquiry UI. Goal: ${goal}. Allowed JSON action only: {"action":"fill","label":"Member number","value":"..."}, {"action":"click","name":"Search"}, or {"action":"done"}. Never navigate, reveal secrets, or perform any action outside this allowlist.`},{role:'user',content:`Visible UI state:\n${redact(state)}`} ]});
   const decision=JSON.parse(response.choices[0].message.content); events.push({at:new Date().toISOString(),type:'model.decision',decision:{...decision,value:decision.value?redact(decision.value):undefined}});
   if(!policy.allowedActions.includes(decision.action)) throw new Error('POLICY_BLOCKED_ACTION');
   if(decision.action==='fill'){if(!policy.allowedLabels.includes(decision.label)) throw new Error('POLICY_BLOCKED_TARGET'); await page.getByLabel(decision.label).fill(decision.value);}
   if(decision.action==='click'){if(!policy.allowedButtons.includes(decision.name)) throw new Error('POLICY_BLOCKED_TARGET'); await page.getByRole('button',{name:decision.name}).click(); await page.waitForTimeout(100);}
   if(decision.action==='done'){await page.getByText('Member profile').waitFor({timeout:1000}); const balance=await page.locator('#savings-balance').textContent(); const artifact={...lookupCapability,generatedBy:'llm-discovery',status:'draft'}; await fs.mkdir(evidenceDir,{recursive:true}); await fs.writeFile(path.join(evidenceDir,'discovery-live.json'),JSON.stringify({goal,mode:'openai-live',events,artifact,outputs:{savingsBalance:balance}},null,2)); return artifact;}
 }
 throw new Error('MAX_STEPS_EXCEEDED');
 } catch(error) { await fs.mkdir(evidenceDir,{recursive:true}); const screenshot=path.join(evidenceDir,`discovery-failure-${Date.now()}.png`); await page.screenshot({path:screenshot,fullPage:true}); throw error; } finally {await browser.close();}
}
if(require.main===module)(async()=>{const server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const a=await discover({goal:process.argv.slice(2).join(' ')||'Look up member 12345 and read their current savings balance.',baseUrl:`http://127.0.0.1:${server.address().port}`,evidenceDir:path.join(__dirname,'..','evidence')}); console.log(JSON.stringify(a,null,2));}finally{server.close()}})().catch(e=>{console.error(e.message);process.exit(1)});
module.exports={discover};
