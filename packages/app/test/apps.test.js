const { expect } = require('chai');

const {
  bootstrap
} = require('./helpers');

const GithubIssues = require('../lib/apps/github-issues');

const nock = require('nock');


function disableConnect() {
  nock.disableNetConnect();
}

function enableConnect() {
  nock.enableNetConnect();
}


describe('apps', () => {

  before(disableConnect);

  after(enableConnect);


  describe('githubIssues', function() {

    let app, githubIssues, columns;

    beforeEach(async function() {
      app = await bootstrap({
        modules: [ GithubIssues ]
      });

      githubIssues = await app.get('githubIssues');

      columns = await app.get('columns');
    });


    describe('state update', function() {

      it('should compute Inbox -> Done', async function() {

        // given
        const issue = {
          labels: [
            {
              name: 'bug'
            }
          ],
          state: 'open'
        };

        const newColumn = columns.getByState('DONE');

        // when
        const update = githubIssues.getStateUpdate(issue, newColumn);

        // then
        expect(update).to.eql({
          update: {
            state: 'closed'
          },
          labelsToAdd: [],
          labelsToRemove: []
        });

      });


      it('should compute Inbox -> Inbox', function() {

        // given
        const issue = {
          labels: [
            {
              name: 'bug'
            }
          ],
          state: 'open'
        };

        const newColumn = columns.getByState('DEFAULT');

        // when
        const update = githubIssues.getStateUpdate(issue, newColumn);

        // then
        expect(update).to.eql({
          update: {},
          labelsToAdd: [],
          labelsToRemove: []
        });

      });


      it('should compute Needs Review -> Done', function() {

        // given
        const issue = {
          labels: [
            {
              name: 'bug'
            },
            {
              name: 'needs review'
            }
          ],
          state: 'open'
        };

        const newColumn = columns.getByState('DONE');

        // when
        const update = githubIssues.getStateUpdate(issue, newColumn);

        // then
        expect(update).to.eql({
          update: {
            state: 'closed'
          },
          labelsToAdd: [],
          labelsToRemove: [ 'needs review' ]
        });

      });


      it('should compute Needs Review -> Inbox', function() {

        // given
        const issue = {
          labels: [
            {
              name: 'bug'
            },
            {
              name: 'needs review'
            }
          ],
          state: 'open'
        };

        const newColumn = columns.getByState('DEFAULT');

        // when
        const update = githubIssues.getStateUpdate(issue, newColumn);

        // then
        expect(update).to.eql({
          update: {},
          labelsToAdd: [],
          labelsToRemove: [ 'needs review' ]
        });

      });


      it('should compute Done -> Done (removing labels)', function() {

        // given
        const issue = {
          labels: [
            {
              name: 'bug'
            },
            {
              name: 'needs review'
            },
            {
              name: 'in progress'
            }
          ],
          state: 'closed'
        };

        const newColumn = columns.getByState('DONE');

        // when
        const update = githubIssues.getStateUpdate(issue, newColumn);

        // then
        expect(update).to.eql({
          update: {},
          labelsToAdd: [],
          labelsToRemove: [ 'in progress', 'needs review' ]
        });

      });

    });


    describe('assignee update', function() {

      it('should assign', function() {

        // given
        const issue = {
          assignees: []
        };

        // when
        const update = githubIssues.getAssigneeUpdate(issue, 'mike');

        // then
        expect(update).to.eql({
          assignees: [
            'mike'
          ]
        });

      });


      it('should handle noop', function() {

        // given
        const issue = {
          assignees: []
        };

        // when
        const update = githubIssues.getAssigneeUpdate(issue, null);

        // then
        expect(update).to.eql({});

      });


      it('should add assignee', function() {

        // given
        const issue = {
          assignees: [
            { login: 'walt' },
            { login: 'lisa' }
          ]
        };

        // when
        const update = githubIssues.getAssigneeUpdate(issue, 'mike');

        // then
        expect(update).to.eql({
          assignees: [
            'walt',
            'lisa',
            'mike'
          ]
        });

      });


      it('should keep assignees', function() {

        // given
        const issue = {
          assignees: [
            { login: 'walt' },
            { login: 'lisa' }
          ]
        };

        // when
        const update = githubIssues.getAssigneeUpdate(issue, 'walt');

        // then
        expect(update).to.eql({ });

      });

    });

  });


});