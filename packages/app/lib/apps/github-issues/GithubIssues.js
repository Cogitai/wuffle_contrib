const {
  findLinks,
  linkTypes
} = require('../../util');

const {
  CLOSES
} = linkTypes;


function GithubIssues(logger, config, columns) {

  const log = logger.child({
    name: 'wuffle:github-issues'
  });


  function getAssigneeUpdate(issue, newAssignee) {

    if (!newAssignee) {
      return {};
    }

    const assignees = issue.assignees.map(assignee => assignee.login);

    if (assignees.includes(newAssignee)) {
      return {};
    }

    return {
      assignees: [
        ...assignees,
        newAssignee
      ]
    };

  }

  function getStateUpdate(issue, newColumn) {

    let update = {};

    const issueState = newColumn.closed ? 'closed' : 'open';

    if (issue.state !== issueState) {
      update = {
        ...update,
        state: issueState
      };
    }

    const issueLabels = issue.labels.map(l => l.name);

    const newLabel = newColumn.label;

    const labelsToAdd = (!newLabel || issueLabels.includes(newLabel)) ? [] : [ newLabel ];

    const labelsToRemove = columns.getAll().map(c => c.label).filter(
      label => label && label !== newLabel && issueLabels.includes(label)
    );

    return {
      update,
      labelsToAdd,
      labelsToRemove
    };
  }

  function findIssue(context, issue_number) {

    const params = context.repo({ issue_number });

    return context.github.issues.get(params)
      .then(response => response.data)
      .catch(error => {

        // gracefully handle not found
        log.debug(params, 'issue not found', error);

        return null;
      });
  }

  function findAndMoveIssue(context, number, newColumn, newAssignee) {
    return findIssue(context, number)
      .then((issue) => issue && moveIssue(context, issue, newColumn, newAssignee));
  }

  async function moveReferencedIssues(context, issue, newColumn, newAssignee) {

    // TODO(nikku): do that lazily, i.e. react to PR label changes?
    // would slower the movement but support manual moving-issue with PR

    const {
      repo: issueRepo,
      owner: issueOwner
    } = context.repo();

    const links = findLinks(issue, CLOSES).filter(link => {
      const {
        repo,
        owner
      } = link;

      return (
        (typeof repo === 'undefined' || repo === issueRepo) &&
        (typeof owner === 'undefined' || owner === issueOwner)
      );
    });

    // TODO(nikku): PR from external contributor
    // TODO(nikku): closes across repositories?

    return Promise.all(links.map(link => {

      const {
        number
      } = link;

      return findAndMoveIssue(context, number, newColumn, newAssignee);
    }));
  }

  function moveIssue(context, issue, newColumn, newAssignee) {

    const {
      number: issue_number
    } = issue;

    const stateUpdate = getStateUpdate(issue, newColumn)

    const contextCalls = [];

    // First add and remove labels as needed.
    if (stateUpdate.labelsToAdd.length) {
      const addLabelsParams = context.repo({
        issue_number,
        labels: stateUpdate.labelsToAdd
      });
      log.info(addLabelsParams, 'update addLabels');
      contextCalls.push(context.github.issues.addLabels(addLabelsParams));
    }

    if (stateUpdate.labelsToRemove.length) {
      stateUpdate.labelsToRemove.forEach(label => {
        const removeLabelParams = context.repo({
          issue_number,
          name: label
        });
        log.info( removeLabelParams, 'update removeLabel ' + label);
        contextCalls.push(context.github.issues.removeLabel(removeLabelParams));
      });
    }

    // Then update state and assignees.
    const update = {
      ...getAssigneeUpdate(issue, newAssignee),
      ...stateUpdate.update
    };

    if (hasKeys(update)) {
      const params = context.repo({
        issue_number,
        ...update
      });
      log.info(params, 'update');
      contextCalls.push(context.github.issues.update(params));
    }

    return Promise.all(contextCalls);
  }


  // api /////////////////////////////

  this.moveIssue = moveIssue;

  this.moveReferencedIssues = moveReferencedIssues;

  this.getStateUpdate = getStateUpdate;

  this.getAssigneeUpdate = getAssigneeUpdate;

  this.findAndMoveIssue = findAndMoveIssue;

}

module.exports = GithubIssues;


// helpers //////////////

function hasKeys(obj) {
  return Object.keys(obj).length > 0;
}