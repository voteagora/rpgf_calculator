const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const readline = require('readline');

const QUORUM = 17;
const MIN_AMOUNT = 1500;
const TOTAL_AMOUNT = 30000000;
const MAX_ITERATIONS = 10;
const inputFilePath = './output/outputVerifySig.csv';
const outputFilePath = './output/outputResultsFinal.csv';

// Function to read CSV file
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Function to prompt and wait for user input
function promptUser(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(message, input => {
      rl.close();
      resolve(input);
    });
  });
}

// Helper function to calculate median, given array of values
function calculateMedian(values) {
  if (values.length === 0) return 0;

  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);

  if (values.length % 2) return values[half];

  return (values[half - 1] + values[half]) / 2.0;
}

// Take all the votes, and calculate the median and vote counts for each unique projectId
function calculateProjectAllocations(data) {
  const projects = {};

  data.forEach(row => {
    if (row.verified_signature !== 'TRUE') return;

    // Parse the signed_payload JSON string into an array of votes
    const votes = JSON.parse(row.signed_payload);

    // Process each vote in the array
    for (vote of votes) {
      const projectId = vote.projectId;
      const amount = parseFloat(vote.amount);

      if (isNaN(amount)) continue; // Skip if amount is NaN

      // Initialize project data structure if it doesn't exist
      if (!projects[projectId]) {
        projects[projectId] = { votes_array: [], votes_count: 0 };
      }

      // Append the amount to the votes_array and increment votes_count
      projects[projectId].votes_array.push(amount);
      projects[projectId].votes_count++;
    }
  });

  // Calculate median_amount and is_eligible for each project, and initialize with is_cut to FALSE
  Object.keys(projects).forEach(projectId => {
    const project = projects[projectId];
    project.median_amount = calculateMedian(project.votes_array);
    project.is_eligible = project.votes_count >= QUORUM;
    project.is_cut = false; // Initialize with is_cut as FALSE
  });

  return projects;
}

// Scale allocations only for projects that are eligible and not cut
function scaleAllocations(projects) {
  const eligibleProjects = Object.values(projects).filter(
    p => p.is_eligible && !p.is_cut
  );
  const totalMedian = eligibleProjects.reduce(
    (acc, p) => acc + p.median_amount,
    0
  );
  const scaleFactor = TOTAL_AMOUNT / totalMedian;

  eligibleProjects.forEach(p => {
    p.scaled_amount = p.median_amount * scaleFactor;
  });

  return projects;
}

// Mark projects for cut if scaled_amount is below MIN_AMOUNT
function markProjectsForCut(projects) {
  Object.entries(projects).forEach(([_, project]) => {
    if (project.is_eligible && project.scaled_amount < MIN_AMOUNT) {
      project.is_cut = true;
      project.scaled_amount = 0; // Set to 0 as it's below the threshold
    } else {
      project.is_cut = false;
    }
  });

  return projects;
}

// Main function to first calculate project allocations, and then scale and cut projects
async function main() {
  const csvData = await readCSV(inputFilePath);
  let projects = calculateProjectAllocations(csvData);
  let previousProjectsForCut = new Set();

  let iteration = 0;
  while (iteration < MAX_ITERATIONS) {
    projects = scaleAllocations(projects);
    projects = markProjectsForCut(projects);

    const currentProjectsForCut = new Set(
      Object.entries(projects)
        .filter(([_, p]) => p.is_cut)
        .map(([address, _]) => address)
    );

    // Check if any new projects have been marked for cut
    const isNewProjectCut = Array.from(currentProjectsForCut).some(
      projectId => !previousProjectsForCut.has(projectId)
    );

    if (isNewProjectCut) {
      console.log(
        `Iteration ${iteration + 1}, Projects for cut:`,
        Array.from(currentProjectsForCut).join(', ')
      );
      await promptUser('Press Enter to continue...');

      previousProjectsForCut = currentProjectsForCut;
    } else {
      break; // Break the loop if no new projects need to be cut
    }

    iteration++;
  }

  // Ensure the sum of all scaled_amount equals TOTAL_AMOUNT
  const totalAllocated = Object.values(projects)
    .filter(p => p.is_eligible && !p.is_cut)
    .reduce((acc, p) => acc + p.scaled_amount, 0);

  if (totalAllocated !== TOTAL_AMOUNT) {
    console.log(
      `Error: Total allocated amount (${totalAllocated}) does not equal TOTAL_AMOUNT (${TOTAL_AMOUNT})`
    );
  } else {
    console.log(
      `Error: Total allocated amount (${totalAllocated}) does not equal TOTAL_AMOUNT (${TOTAL_AMOUNT})`
    );
  }

  // Export final results
  const finalData = Object.entries(projects).map(([address, project]) => ({
    project_id: address,
    votes_array: project.votes_array,
    votes_count: project.votes_count,
    median_amount: project.median_amount,
    is_eligible: project.is_eligible,
    is_cut: project.is_cut,
    scaled_amount:
      project.is_eligible && !project.is_cut ? project.scaled_amount : 0,
  }));

  // Define the CSV writer
  const csvWriter = createObjectCsvWriter({
    path: outputFilePath,
    header: [
      { id: 'project_id', title: 'Project ID' },
      { id: 'votes_array', title: 'Votes Array' },
      { id: 'votes_count', title: 'Votes Count' },
      { id: 'median_amount', title: 'Median Amount' },
      { id: 'is_eligible', title: 'Is Eligible' },
      { id: 'is_cut', title: 'Is Cut' },
      { id: 'scaled_amount', title: 'Scaled Amount' },
    ],
  });

  await csvWriter.writeRecords(finalData);
  console.log(`Results saved in ${outputFilePath}`);
}

main().catch(console.error);
