// ==UserScript==
// @name           Some minor fixes for JIRA
// @namespace      https://gist.github.com/talmuth/e3abd629add49c0afd4f
// @description    Some minor fixes for JIRA
// @include        http://jira.odesk.com/*
// @updateURL      http://bit.ly/bpa-ag-jira-js-tweaks
// @version        0.6.4
// @require        https://gist.github.com/BrockA/2625891/raw/waitForKeyElements.js
// @require        http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js
// ==/UserScript==

(function() {
    /* global waitForKeyElements */
    /* global GH */
    waitForKeyElements('#ghx-work .ghx-parent-group.js-fake-parent', function(node) {
        var issue = $(node).data('issue-key'),
            $key = $(node).find('.ghx-group .ghx-key');
        $key.text('');

        $('<a href="/browse/' + issue + '" title="' + issue + '" class="ghx-key-link js-detailview">' + issue + '</a>').appendTo($key);
        $key.find('a').click(GH.WorkSelectionController.handleIssueClick);
    });

    waitForKeyElements('#ghx-detail-issue', function(node) {
        var $epic = $(node).find('.ghx-fieldname-customfield_10911 .js-epic-remove');
        if ($epic.length) {
            $epic.empty().css({
                paddingRight: '3px'
            });
            var issue = $epic.data('epickey');
            $('<a href="/browse/' + issue + '" target="_blank" title="' + issue + '" class="ghx-key-link js-detailview">' + $epic.prop('title') + '</a>').appendTo($epic);
        }
    });

    waitForKeyElements('.BPA-RapidBoard #ghx-pool .ghx-swimlane', function(node) {
        var $issues = $(node).find('.ghx-issue'),
            issues = $issues.map(function() {
                return $(this).data('issue-key');
            });
        if ($issues.length > 0) {
            $.ajax({
                type: 'GET',
                url: '/rest/api/2/search?jql=key+in(' + issues.toArray().join(',') + ')&fields=timetracking,customfield_10910&maxResults=1000',
                contentType: 'application/json'
            })
                .done(function(data) {
                var epics = [];
                data.issues.forEach(function(issue) {
                    var $issue = $issues.filter('[data-issue-key="' + issue.key + '"]');
                    $('<div style="position:absolute;right:38px;top:6px;" class="bpa-badges">' +
                        '<span class="aui-badge" title="Remaining Time Estimate" style="background:#' + (issue.fields.timetracking.remainingEstimate ? 'ccc' : 'eb00e3') + '">' +
                        (issue.fields.timetracking.remainingEstimate || "?") + '</span></div>').appendTo($issue);

                    if (issue.fields.timetracking.remainingEstimateSeconds) {
                        var days = Math.round(issue.fields.timetracking.remainingEstimateSeconds / 7200);
                        $issue.attr('class', $issue.attr('class').replace(/ghx-days-\d+/, 'ghx-days-' + (days <= 32 ? days : '32')));
                        $issue.find('.ghx-days').attr('title', 'Remaining estimate in hours').addClass('display-anyway');
                    }

                    if (issue.fields.customfield_10910) {
                        epics.push(issue.fields.customfield_10910);
                        $issue.attr('data-epic-key', issue.fields.customfield_10910);
                    }
                });
                if (epics.length) {
                    $.ajax({
                        type: 'GET',
                        url: '/rest/api/2/search?jql=key+in(' + epics.join(',') + ')&fields=customfield_10911,customfield_10913&maxResults=1000',
                        contentType: 'application/json'
                    })
                        .done(function(data) {
                        data.issues.forEach(function(issue) {
                            var $issue = $issues.filter('[data-epic-key="' + issue.key + '"]');

                            $issue.find('.ghx-summary').addClass('aui-label').css({
                                backgroundColor: issue.fields.customfield_10913,
                                top: '-2px !important'
                            });

                            $('<a href="/browse/' + issue.key + '" target="_blank" title="' + issue.key + '" ' +
                                'style="background-color:' + issue.fields.customfield_10913 + ';text-transform:none;margin-right:3px;" ' +
                                'class="aui-badge">' + issue.fields.customfield_10911 + '</a>').prependTo($issue.find('.bpa-badges'));
                        });
                    });
                }
            });
        }
    });

    $('a[href^="https://support.odesk.com/tickets/"]').each(function() {
        $(this).prop('href', 'https://int.odesk.com/obo/zendesk-request/' + $(this).prop('href').split('tickets/')[1]).prop('target', '_blank');
    });

    if ($('#status-val.value img[alt="In Progress"]').length && $('#customfield_10014-val').length) {
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

    if (window.location.href.match(/(?:RapidBoard\.jspa\?rapidView=(?:228|238)|Dashboard\.jspa\?selectPageId=10810|ifr\?container=atlassian\&mid=12631)/)) {
        $('body').addClass('BPA-RapidBoard');
    }
})();
