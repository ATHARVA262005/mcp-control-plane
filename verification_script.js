import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('1. Checking Health...');
  const health = await fetch('http://localhost:3000/health').then(r => r.json());
  console.log('Health:', health);

  console.log('\n2. Creating Workflow...');
  const createRes = await fetch(`${BASE_URL}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'Search for "Model Context Protocol"',
      context: { userId: 'user123' }
    })
  });
  
  const workflow = await createRes.json();
  console.log('Workflow Created:', workflow);
  
  if (!workflow._id) {
    console.error('Failed to create workflow');
    return;
  }

  console.log('\n3. Polling for completion...');
  let attempts = 0;
  while (attempts < 10) {
    const statusRes = await fetch(`${BASE_URL}/workflows/${workflow._id}`);
    const updatedWorkflow = await statusRes.json();
    console.log(`[${attempts + 1}] Status: ${updatedWorkflow.status}`);
    
    // Also fetch tasks/logs to see progress if we had a tasks endpoint, checking logs instead
    const logsRes = await fetch(`${BASE_URL}/workflows/${workflow._id}/logs`);
    const logs = await logsRes.json();
    if (logs.length > 0) {
       console.log('Last Log:', logs[0].eventType, logs[0].details);
    }

    if (updatedWorkflow.status === 'COMPLETED' || updatedWorkflow.status === 'FAILED') {
      break;
    }
    
    await sleep(2000); // Wait 2s
    attempts++;
  }
}

run().catch(console.error);
