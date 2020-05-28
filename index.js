const core = require("@actions/core");
const github = require("@actions/github");
const tc = require('@actions/tool-cache');

async function downloadGambit() {
  const api = new github.GitHub(core.getInput('github-token', { required: true }));
  const [owner, repo] = core.getInput('repo').split('/');
  const localPath = core.getInput('localPath');

  const buildOptions = {
    owner,
    repo,
    os: core.getInput('os') || getDefaultOS(),
    arch: core.getInput('arch'),
    branch: core.getInput('branch'),
    workflowName:  core.getInput('workflow-name')
  };

  const artifactUrl = await getArtifactUrl(api, buildOptions);
  const downloadPath = await tc.downloadTool(artifactUrl);

  let fullPath = undefined;
  if (buildOptions.os.startsWith("win")) {
    fullPath = await tc.extractZip(downloadPath, localPath);
  } else {
    fullPath = await tc.extractTar(downloadPath, localPath);
  }

  // Add folder to cache
  // https://github.com/actions/toolkit/tree/master/packages/tool-cache#cache

  // Add local Gambit directory to PATH for future steps
  core.addPath(fullPath);
}

function getDefaultOS() {
  switch (process.platform) {
  case "linux":
    return "linux";
  case "darwin":
    return "macos";
  case "win32":
    return "win-msvc";
  default:
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

async function getArtifactUrl(api, options) {
  const { owner, repo, branch, os, arch, workflowName } = options;

  const workflows = await api.actions.listRepoWorkflows({
    owner,
    repo
  });

  const workflow = workflows.data.workflows.find(
    w => w.name === workflowName
  );

  if (!workflow) {
    throw new Error(`Repository '${owner}/${repo}' does not have a workflow named ${workflowName}.`);
  }

  const runs = await api.actions.listWorkflowRuns({
    owner,
    repo,
    branch,
    status: "completed",
    workflow_id: workflow.id
  });

  // Find the most recent successful run
  const latestRun = runs.data.workflow_runs.find(
    r => r.conclusion === "success"
  );

  const artifacts = await api.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: latestRun.id
  });

  const artifactToFind = `gambit-${os}-${arch}`;
  const foundArtifact = artifacts.data.artifacts.find(
    a => a.name === artifactToFind
  );

  return foundArtifact.archive_download_url;
}

downloadGambit();