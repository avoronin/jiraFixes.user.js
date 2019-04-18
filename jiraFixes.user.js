// ==UserScript==
// @name           Some minor fixes for JIRA
// @namespace      https://github.com/talmuth/jiraFixes.user.js
// @description    Some minor fixes for JIRA
// @include        https://jira.odesk.com/*
// @include        http://jira.odesk.com/*
// @updateURL      http://bit.ly/bpa-ag-jira-js-tweaks-v2
// @version        0.15.2
// @resource       UI_CSS http://bit.ly/bpa-ag-jira-css-for-usersript
// @require        https://ajax.googleapis.com/ajax/libs/jquery/2.2.0/jquery.min.js
// @grant          GM_addStyle
// @grant          GM_getResourceText
// ==/UserScript==

/* jshint -W097 */
'use strict';

(function() {
    /* global GH */
    /* global AJS */
    /* global $ */

    GM_addStyle(GM_getResourceText("UI_CSS"));

    GH = GH || {};
    GH.SwimlaneView = GH.SwimlaneView || {};
    GH.SwimlaneView._rerenderCell = GH.SwimlaneView.rerenderCell;
    GH.SwimlaneView.rerenderCell = function(E, G) {
        GH.SwimlaneView._rerenderCell(E, G);

        JH.fn.renderEstimates(E);
        JH.fn.renderEpicInfo(E);
        JH.fn.renderBlockers(E);
    };
    GH.SwimlaneView.AG = {};

    var JH = {};
    JH.fn = {};
    JH.config = {
        selectors: {
            affectedVersion: '#customfield_12512-val',
            fixedVersion: '#customfield_12511-val'
        }
    };
    JH.$body = $('body');

    JH.fn.formatHours = function(seconds) {
        var d = seconds / 3600 / 8,
            h = Math.round(8 * (d - Math.floor(d)));

        return Math.floor(d) + ' days' + (h > 0 ? ' ' + h + ' hours':'');
    };
    JH.fn.renderBlocks = function(issue) {
        $.ajax({
            type: 'GET',
            url: '/rest/api/2/search?jql=issue+in+linkedIssues("' + $(issue).data('issue-key') + '",+"blocks")+and+resolutiondate+is+empty',
            contentType: 'application/json'
        })
        .done(function(data) {
            if (data.total > 0) {
                var $flags = $(issue).find('.ghx-flags');
                $flags.find(' .ghx-priority, .ghx-flag').remove();
                $flags.append('<span class="ghx-priority js-blocker-issue" title="Blocks ' + data.total + ' issue(s)" />');
            }
        });
    };
    JH.fn.updateSwimlane = function() {
        var $node = $(this),
            $issues = $node.find('.ghx-issue'),
            issues = $issues.map(function() {
                return $(this).data('issue-key');
            }),
            swimlaneId = $node.attr('swimlane-id');

        GH.SwimlaneView.AG[swimlaneId] = {};
        GH.SwimlaneView.AG[swimlaneId].issues = [];
        GH.SwimlaneView.AG[swimlaneId].epics = [];

        if ($issues.length > 0) {
            JH.fn.renderEpicInfo(swimlaneId);

            $.ajax({
                type: 'GET',
                url: '/rest/api/2/search?jql=key+in(' + issues.toArray().join(',') + ')&fields=timetracking,customfield_10000,customfield_10910&maxResults=1000',
                contentType: 'application/json'
            })
            .done(function(data) {
                GH.SwimlaneView.AG[swimlaneId].issues = data.issues || [];
                JH.fn.renderEstimates(swimlaneId);
            });
            JH.fn.renderBlockers(swimlaneId);
        }
    };
    JH.fn.makeFakeParentsClickable = function() {
        var issue = $(this).data('issue-key'),
            $key = $(this).find('.ghx-group .ghx-key');
        $key.text('');

        $('<a href="/browse/' + issue + '" title="' + issue + '" class="ghx-key-link js-detailview">' + issue + '</a>').appendTo($key);
        $key.find('a').click(GH.WorkSelectionController.handleIssueClick);
    };
    JH.fn.makeEpicClickableInDetailView = function() {
        var $epic = $('.ghx-fieldname-customfield_10911 .js-epic-remove', this)
        if ($epic.length) {
            var issue = $epic.data('epickey');
            var $new = $('<a href="/browse/' + issue + '" target="_blank" title="' + issue + '" class="' + $epic.prop('class') +  ' ">' + $epic.prop('title') + '</a>');
            $epic.replaceWith($new);
            $new.removeClass('aui-label-closeable js-epic-remove');
        }
    };
    JH.fn.addBadgeToIssue = function($badge, $issue) {
        if ($issue.filter(':not(:has(.bpa-badges))').length == 1) {
             $('<div style="position:absolute;right:38px;top:6px;" class="bpa-badges"></div>').appendTo($issue);
        }

        var $badges = $issue.find('.bpa-badges');
        $badge.appendTo($badges);
    };
    JH.fn.renderEstimates = function(swimlaneId) {
        var $swimlane = $("#ghx-pool").find('.ghx-swimlane[swimlane-id="' + swimlaneId + '"]'),
            $issues = $swimlane.find('.ghx-issue'),
            $header = $swimlane.find('.ghx-heading .ghx-info'),
            $days = $header.find('.js-days-info'),
            days, total = 0, flagged = 0;

        GH.SwimlaneView.AG[swimlaneId].issues.forEach(function(issue) {
            var $issue = $issues.filter('[data-issue-key="' + issue.key + '"]');
            if ($issue.length === 0) return;

            JH.fn.addBadgeToIssue($('<span class="aui-label" title="Remaining Time Estimate" style="background:#' + (issue.fields.timetracking.remainingEstimate ? 'ccc' : 'eb00e3') + '">' +
                (issue.fields.timetracking.remainingEstimate || "?") + '</span></div>'), $issue);

            if (issue.fields.timetracking.remainingEstimateSeconds) {
                days = Math.round(issue.fields.timetracking.remainingEstimateSeconds / 7200);
                $issue.attr('class', $issue.attr('class').replace(/ghx-days-\d+/, 'ghx-days-' + (days <= 32 ? days === 0 ? 1 : days : '32')));
                $issue.find('.ghx-days').attr('title', 'Remaining estimate in hours').addClass('display-anyway');

                total += issue.fields.timetracking.remainingEstimateSeconds;

                if (issue.fields.customfield_10000) {
                    flagged += issue.fields.timetracking.remainingEstimateSeconds;
                }
            }

            if (issue.fields.customfield_10910) {
                $issue.attr('data-epic-key', issue.fields.customfield_10910);
            }
        });

        if ($days.length === 0) {
            $days = $('<span class="ghx-description js-days-info" style="margin-left:.3em;"/>').appendTo($header);
        }

        var text = '/ ' + JH.fn.formatHours(total);
        if (flagged > 0) {
            text += ' (flagged: ' + JH.fn.formatHours(flagged) + ')';
        }
        $days.text(text);
    };
    JH.fn.renderEpicInfo = function(swimlaneId) {
        var $swimlane = $("#ghx-pool").find('.ghx-swimlane[swimlane-id="' + swimlaneId + '"]'),
            $issues = $swimlane.find('.ghx-issue:has(.ghx-highlighted-fields [data-epickey])');
        $issues.each(function(_, issue) {
            var $issue = $(issue), $epic = $issue.find('[data-epickey]');
            JH.fn.addBadgeToIssue($epic, $issue);

            $issue.find('.ghx-summary').addClass($epic.prop('class')).css({
                top: '-2px !important'
            });
        });
    };
    JH.fn.renderBlockers = function(swimlaneId) {
        var $swimlane = $("#ghx-pool").find('.ghx-swimlane[swimlane-id="' + swimlaneId + '"]'),
            $issues = $swimlane.find('.ghx-issue');//.ghx-flagged');

        $issues.each(function(_, issue) {
            $.ajax({
                type: 'GET',
                url: '/rest/api/2/search?jql=issue+in+linkedIssues("' + $(issue).data('issue-key') + '",+"is+blocked+by")+and+resolutiondate+is+empty',
                contentType: 'application/json'
            })
            .done(function(data) {
                if (data.total > 0) {
                    var $flags = $(issue).find('.ghx-flags');
                    $flags.find(' .ghx-priority, .ghx-flag').remove();
                    if (data.issues.filter(function(issue){ return $.inArray(issue.fields.issuetype.name, ['RequestSubtask', 'Request']) < 0; }).length > 0) {
                        $flags.append('<span class="ghx-priority js-blocked-issue" title="Blocked by ' + data.total + ' issue(s)" />');
                    } else {
                        $flags.append('<span class="ghx-priority js-blocked-by-request" title="Blocked by ' + data.total + ' request(s)" />');
                    }
                }  else {
                    JH.fn.renderBlocks(issue);
                }
            });
        });
    };
    JH.fn.updateLinks = function($target) {
        var $links = $('a', $target || 'body');
        $links.filter('a[href^="https://support.odesk.com/tickets/"],a[href^="https://upwork.zendesk.com/agent/tickets/"]').each(function() {
            $(this).prop('href', 'https://int.upwork.com/obo/zendesk-request/' + $(this).prop('href').split('tickets/')[1]).prop('target', '_blank');
        });
    };
    JH.fn.renderReviewButtons = function () {
        if ($('#opsbar-opsbar-transitions .review-status-trigger').length > 0) return;
        if ($('#status-val.value').text().trim() == 'In Progress' && $('#customfield_10014-val').length) {
            var $user = $('#header-details-user-fullname');

            if ($('#assignee-val .user-hover').attr('rel') == $user.data('username')) {
                if ($.inArray($('#customfield_11511-val.value').text().trim(), ['No', 'Denied']) >= 0) {
                    $('<li class="toolbar-item"><a class="toolbar-trigger review-status-trigger" data-status="Requested">Request review<a></li>').appendTo('#opsbar-opsbar-transitions');
                }
            } else if ($('#customfield_10014-val .user-hover').attr('rel') == $user.data('username')) {
                if ($('#customfield_11511-val.value').text().trim() == 'Requested') {
                    $('<li class="toolbar-item"><a class="toolbar-trigger review-status-trigger" href="#" data-status="Approved">Approve<a></li>' +
                      '<li class="toolbar-item"><a class="toolbar-trigger review-status-trigger" href="#" data-status="Denied">Deny<a></li>').appendTo('#opsbar-opsbar-transitions');
                }
            }

            $('#opsbar-opsbar-transitions .review-status-trigger').click(function() {
                var $reviewer = $('#customfield_10014-val'),
                    issue = $('#key-val').data('issue-key');
                if ($reviewer.length) {
                    var reviewerId = $reviewer.find('.user-hover').attr('rel');
                    if ($('#customfield_11135-field .tinylink > .user-hover[rel=' + reviewerId + ']').length === 0) {
                        $.ajax({
                            type: 'POST',
                            url: '/rest/api/2/issue/' + issue + '/watchers',
                            contentType: 'application/json',
                            data: JSON.stringify(reviewerId)
                        });
                    }
                }

                $.ajax({
                    type: 'PUT',
                    url: '/rest/api/2/issue/' + issue,
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        "fields": {
                            "customfield_11511": {
                                "value": $(this).data('status')
                            }
                        }
                    })
                })
                    .done(function() {
                    location.reload();
                });
            });
        }
    };
    JH.fn.versionToString = function(version) {
        return 'v' + version.split(',').map(function(x){ return x*1; }).join('.');
    };
    JH.fn.renderVersions = function() {
        if ($(JH.config.selectors.affectedVersion + ',' + JH.config.selectors.fixedVersion).length == 0) {
            console.debug('JH: No affected or fixed version found');
            return;
        }

        var currentProject = $('#project-name-val').text();
        console.debug('JH: Project detected - ' + currentProject);
        var components = $('#components-field > a').map(function(){return '"' + $.trim($(this).attr('title')) + '"';}).toArray().join();
        console.debug('JH: Components detected - ' + components);

        var $affectedVersion = $('#customfield_12512-val'), affectedVersion;
        if ($affectedVersion.length) {
            if (!$affectedVersion.data('affectedVersion')) {
                $affectedVersion.data('affectedVersion', $.trim($affectedVersion.text()));
            }
            console.debug('JH: Affected version - ' + (affectedVersion = $affectedVersion.data('affectedVersion')));

            if (affectedVersion.length) {
                var affectedVersionString = JH.fn.versionToString($affectedVersion.data('affectedVersion'));
                if (components.length) {
                    $affectedVersion.empty()
                        .append('<a target="_blank" href="/issues/?jql=' +
                                    encodeURIComponent('project = ' + currentProject +
                                                       ' and component in (' + components +
                                                       ') and "Affected Version" = ' + $affectedVersion.data('affectedVersion').replace(/,/g, '')) +
                                    '">' + affectedVersionString + '</a>');
                } else {
                    $affectedVersion.text(affectedVersionString);
                }

                $('#versions-val').closest('#issuedetails li.item').before($('#rowForcustomfield_12512')).remove();
            }
        }

        var $fixedVersion = $('#customfield_12511-val'), fixedVersion;
        if ($fixedVersion.length) {
            if (!$fixedVersion.data('fixedVersion')) {
                $fixedVersion.data('fixedVersion', $.trim($fixedVersion.text()));
            }
            console.debug('JH: Fixed version - ' + (fixedVersion = $fixedVersion.data('fixedVersion')));
            if (fixedVersion.length) {
                var fixedVersionString = JH.fn.versionToString(fixedVersion);
                if (components.length) {
                    $fixedVersion.empty()
                        .append('<a target="_blank" href="/issues/?jql=' +
                                encodeURIComponent('project = ' + currentProject +
                                                   ' and component in (' + components +
                                                   ') and ("Fixed Version" = ' + fixedVersion.replace(/,/g, '') +
                                                   ' or "Affected Version" = ' + fixedVersion.replace(/,/g, '') + ')') +
                                '">' + fixedVersionString + '</a>');
                } else {
                    $fixedVersion.text(fixedVersionString);
                }
                $('#fixfor-val').closest('#issuedetails li.item').remove();
                $('#rowForcustomfield_12512').after($('#rowForcustomfield_12511').addClass('item-right'));
            }
        }
    };

    JH.fn.renderIssue = function() {
        JH.fn.renderReviewButtons();
        JH.fn.updateLinks();
        JH.fn.renderVersions();
    };

    JH.GH = {};
    JH.GH.$element = $('#gh');
    JH.GH.fn = {};
    if (JH.GH.$element.length) {

    }

    JH.I = {};
    JH.I.$element = $('#jira');
    JH.I.fn = {};
    if (JH.I.$element.length) {
        JH.I.fn.muCallback = function(mutations, mut) {
            mutations.map(function(mutation){
                if (mutation.target.id == 'components-val' && mutation.type == 'attributes' && mutation.attributeName == 'class' && $(mutation.target).is('.inactive')) {
                    JH.fn.renderIssue();
                } else if (mutation.target.id == 'stalker' && mutation.type == 'childList' && $('#opsbar-opsbar-transitions .review-status-trigger', $(mutation.addedNodes)).length == 0) {
                    JH.fn.renderReviewButtons();
                } else if (mutation.target.className == 'detail-content-container' && mutation.type == 'childList' && mutation.addedNodes.length > 0) { // update PR block after loading
                    JH.fn.updateLinks($(mutation.target));
                }
            });
        };
        JH.I.mu = new MutationObserver(JH.I.fn.muCallback);

        JH.I.mu.observe(JH.I.$element.get(0), {
            attributes: true,
            childList: true,
            characterData: true,
            characterDataOldValue: true,
            subtree: true
        });
        JH.fn.renderIssue();
        JH.fn.renderReviewButtons();
    }

    JH.fn.toggleBpaMode = function(mode) {
        JH.$body.toggleClass('BPA-RapidBoard');
        localStorage.setItem('FH.gh.RapidBoard.BPAMode.' + JH.GH.boardId, JH.$body.is('.BPA-RapidBoard'));
        GH.RapidBoard.reload();
    };

    JH.fn.addCustomButtons = function($target) {
        $target
            .append($('<button class="aui-button js-refresh-now">Refresh</button>').click(GH.RapidBoard.reload))
            .append($('<button class="aui-button js-bpa-mode">BPA Mode</button>').click(JH.fn.toggleBpaMode));
    };

    if (JH.GH.$element.length) {
        JH.GH.boardId = document.location.search.match(/rapidView=(\d+)/)[1];

        JH.GH.boardState = localStorage.getItem('FH.gh.RapidBoard.BPAMode.' + JH.GH.boardId);

        JH.fn.addCustomButtons($('#ghx-view-pluggable .ghx-view-section:last'));

        if (JH.GH.boardState === null || JH.GH.boardState === 'true') {
            JH.$body.addClass('BPA-RapidBoard');
        }

        if (AJS.keys) {
            AJS.keys.shortcuts.push({
                "moduleKey": "greenhopper-ashboard-refresh",
                "keys": [
                    ["r"]
                ],
                "context": "greenhopper",
                "op": "execute",
                "param": "GH.RapidBoard.reload();"
            });
            AJS.activeShortcuts = AJS.whenIType.fromJSON(AJS.keys.shortcuts);
        }

        JH.GH.fn.muCallback = function(mutations, mut) {
            if (JH.$body.is(':not(.BPA-RapidBoard)')) return;

            mutations.map(function(mutation){
                if (mutation.type == 'childList' && mutation.target.id == 'ghx-pool') {
                    var $lanes = $(mutation.addedNodes).filter('.ghx-swimlane');
                    $lanes.map(JH.fn.updateSwimlane);
                    $('.ghx-parent-group.js-fake-parent', $lanes).map(JH.fn.makeFakeParentsClickable);
                } else if (mutation.type == 'childList' && mutation.target.id == 'ghx-detail-contents' ) {
                    $(mutation.addedNodes).map(JH.fn.makeEpicClickableInDetailView);
                } else if (mutation.type == 'childList' && 'ghx-view-pluggable' == mutation.target.id) {
                     JH.fn.addCustomButtons($('.ghx-view-section:last', mutation.target));
                }
            });
        };
        JH.GH.mu = new MutationObserver(JH.GH.fn.muCallback);

        JH.GH.mu.observe(JH.GH.$element.get(0), {
            attributes: true,
            childList: true,
            characterData: true,
            characterDataOldValue: true,
            subtree: true
        });
    }

    document.JH = JH;
})();
