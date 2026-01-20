import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('Expected Result: See below for each test case.');
  console.log('--------------------------------------------------');

  // Check Health
  try {
    await fetch('http://localhost:3000/health').then(r => r.json());
    console.log('Server is UP (Health Check Passed)');
  } catch (e) {
    console.log('Server is DOWN or Unreachable. Please start the server.');
    process.exit(1);
  }

  // --- TEST CASE 1 & 3: Valid Workflow + Polling ---
  console.log('\n[Test Case 1 & 3] Create Valid Workflow & Poll Status');
  console.log('Test: Create workflow with goal "Search for MCP documentation"');
  console.log('Expected: Status transitions to COMPLETED');
  
  let wf1Id;
  try {
    const res = await fetch(`${BASE_URL}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: 'Search for MCP documentation' })
    });
    const wf = await res.json();
    wf1Id = wf._id;
    console.log(`Action: Created Workflow ID: ${wf1Id}, Initial Status: ${wf.status}`);

    let finalStatus = wf.status;
    let attempts = 0;
    while (['PENDING', 'RUNNING'].includes(finalStatus) && attempts < 15) {
        await sleep(1000);
        const pollRes = await fetch(`${BASE_URL}/workflows/${wf1Id}`);
        const pollWf = await pollRes.json();
        finalStatus = pollWf.status;
        process.stdout.write(`.`); // polling indicator
        attempts++;
    }
    console.log(`\nActual Result: Final Status = ${finalStatus}`);
    
    if (finalStatus === 'COMPLETED') {
        console.log('PASS');
    } else {
        console.log('FAIL - Did not complete in time or failed');
    }

  } catch (e) {
    console.error('FAIL - Exception:', e.message);
  }

  // --- TEST CASE 4: Verify Audit Logs ---
  console.log('\n[Test Case 4] Verify Audit Logs');
  console.log('Test: Fetch logs for the completed workflow');
  console.log('Expected: Array of logs with entries');

  if (wf1Id) {
    try {
        const logsRes = await fetch(`${BASE_URL}/workflows/${wf1Id}/logs`);
        const logs = await logsRes.json();
        console.log(`Actual Result: Retrieved ${logs.length} logs`);
        if (logs.length > 0) {
            console.log('PASS');
        } else {
            console.log('FAIL - No logs found');
        }
    } catch (e) {
        console.error('FAIL - Exception:', e.message);
    }
  } else {
      console.log('SKIP - Prerequisite Test Case 1 failed');
  }

  // --- TEST CASE 2: Invalid Tool ---
  console.log('\n[Test Case 2] Create Workflow with Invalid Tool');
  console.log('Test: Create workflow with tool: "INVALID_TOOL_ID"');
  console.log('Expected: Status transitions to FAILED');

  try {
    const res = await fetch(`${BASE_URL}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Attempting to force an invalid tool usage. 
        // If the API ignores 'tool', this might incorrectly PASS/FAIL depending on goal.
        body: JSON.stringify({ goal: 'Do something impossible', tool: 'INVALID_TOOL_ID' })
    });
    const wf = await res.json();
    const wf2Id = wf._id;
    console.log(`Action: Created Workflow ID: ${wf2Id}`);

    let finalStatus = wf.status;
    let attempts = 0;
    while (['PENDING', 'RUNNING'].includes(finalStatus) && attempts < 10) {
        await sleep(1000);
        const pollRes = await fetch(`${BASE_URL}/workflows/${wf2Id}`);
        const pollWf = await pollRes.json();
        finalStatus = pollWf.status;
        process.stdout.write(`.`);
        attempts++;
    }
    console.log(`\nActual Result: Final Status = ${finalStatus}`);

    if (finalStatus === 'FAILED') {
        console.log('PASS');
    } else {
        console.log('FAIL - Expected FAILED, got ' + finalStatus);
    }

  } catch (e) {
      console.error('FAIL - Exception:', e.message);
  }
}

runTests();
