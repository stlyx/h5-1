(function () {
    "use strict";

    var module = angular.module("WorkflowGraph", []);

    function intersectRect(node, point) {
        var x = node.x;
        var y = node.y;

        // Rectangle intersection algorithm from:
        // http://math.stackexchange.com/questions/108113/find-edge-between-two-boxes
        var dx = point.x - x;
        var dy = point.y - y;
        var w = node.width / 2;
        var h = node.height / 2;

        var sx, sy;
        if (Math.abs(dy) * w > Math.abs(dx) * h) {
            // Intersection is top or bottom of rect.
            if (dy < 0) {
                h = -h;
            }
            sx = dy === 0 ? 0 : h * dx / dy;
            sy = h;
        } else {
            // Intersection is left or right of rect.
            if (dx < 0) {
                w = -w;
            }
            sx = w;
            sy = dx === 0 ? 0 : w * dy / dx;
        }

        return [{x: x + sx, y: y + sy}];
    }

    function intersectEllipse(node, rx, ry, point) {
        // Formulae from: http://mathworld.wolfram.com/Ellipse-LineIntersection.html

        var cx = node.x;
        var cy = node.y;

        var px = cx - point.x;
        var py = cy - point.y;

        var det = Math.sqrt(rx * rx * py * py + ry * ry * px * px);

        var dx = Math.abs(rx * ry * px / det);
        if (point.x < cx) {
            dx = -dx;
        }
        var dy = Math.abs(rx * ry * py / det);
        if (point.y < cy) {
            dy = -dy;
        }

        return [{x: cx + dx, y: cy + dy}];
    }

    function intersectCircle(node, rx, point) {
        return intersectEllipse(node, rx, rx, point);
    }

    var renderAnchorNode = function (text) {
        return function (root, node) {
            var view = {};

            root.classed("anchor", true);

            root.append("text")
                .attr("class", "label")
                .append("tspan")
                .attr("xml:space", "preserve")
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "central")
                .text(text);

            var padding = 20;
            var bbox = root.node().getBBox();
            var width = bbox.width + padding;
            var height = bbox.height + padding;
            var r = Math.max(width, height) / 2;

            root.insert("circle", ":first-child")
                .classed("shape", true)
                .attr("x", -bbox.width / 2)
                .attr("y", -bbox.height / 2)
                .attr("r", r);

            node.width = width;
            node.height = height;

            view.intersect = function (point) {
                return intersectCircle(node, r, point);
            };

            return view;
        };
    };

    var renderStartNode = renderAnchorNode("Start");
    var renderEndNode = renderAnchorNode("End");

    var renderStateNode = function (root, node, layout) {
        root.classed("state", true)
            .classed(node.state.Type, true)
            .classed("NotYetStarted", true);

        if (node.state.Type === "Parallel" || node.state.Type === "Map") {
            root.classed("Container", true);
        }

        if (node.state.Type === "Parallel") {
            return renderParallelState(root, node, layout);
        } else
            if (node.state.Type === "Map") {
                return renderMapState(root, node, layout);
            } else {
                return renderRegularState(root, node);
            }
    };

    var renderRegularState = function (root, node) {
        var view = {};

        root.append("text")
            .attr("class", "label")
            .append("tspan")
            .attr("xml:space", "preserve")
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "central")
            .text(node.stateName);

        var padding = 20;
        var bbox = root.node().getBBox();
        var width = bbox.width + padding;
        var height = bbox.height + padding;

        var rect = root.insert("rect", ":first-child")
            .classed("shape", true)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("x", -width / 2)
            .attr("y", -height / 2)
            .attr("width", width)
            .attr("height", height);

        node.width = width;
        node.height = height;

        view.intersect = function (point, direction) {
            return intersectRect(node, point);
        };

        return view;
    };

    function renderParallelState(root, node, layout) {
        var view = {};

        var p = 20;
        var pt = 40;
        var s = 20;

        var branchesRoot = root.append("g").classed("branches", true);
        var branches = [];

        var dx = 0;
        var dy = 0;
        for (var i = 0; i < node.state.Branches.length; i++) {
            var branchDefinition = node.state.Branches[i];
            var branchRoot = branchesRoot.append("g").classed("branch", true);

            var branchGraph = renderBranch(branchRoot, branchDefinition, false, layout);
            var branchBbox = branchRoot.node().getBBox();
            branches.push({
                dx: dx,
                dy: dy,
                height: branchBbox.height,
                width: branchBbox.width,
                startNode: branchGraph.node("state-" + branchDefinition.StartAt)
            });

            branchRoot.attr("transform", "translate(" + dx + "," + dy + ")");
            if (layout === "LR") {
                dy += branchBbox.height + s;
            } else {
                // layout === "TD" or undefined
                dx += branchBbox.width + s;
            }
        }

        // adjust branch root to align prev, curr and next state
        if (layout === "LR") {
            branchesRoot.attr("transform", "translate(" + 2 * p + "," + p + ")");
        } else {
            branchesRoot.attr("transform", "translate(" + p + "," + 2 * p + ")");
        }

        var branchesBbox = branchesRoot.node().getBBox();
        var bw = branchesBbox.width;
        var bh = branchesBbox.height;

        var width = 2 * p + bw;
        var height = 2 * p + bh;
        // add padding to the entry side of arrows
        if (layout === "LR") {
            width += p;
        } else {
            height += p;
        }

        for (var j = 0; j < branches.length; j++) {
            var branch = branches[j];
            if (layout === "LR") {
                renderArrow(root,
                    [{x: 0, y: height / 2}, {x: p, y: height / 2}, {x: p, y: p + branch.dy + branch.startNode.y},
                        {x: 2 * p, y: p + branch.dy + branch.startNode.y}]);
            } else {
                renderArrow(root,
                    [{x: width / 2, y: 0}, {x: width / 2, y: p}, {x: p + branch.dx + branch.startNode.x, y: p},
                        {x: p + branch.dx + branch.startNode.x, y: 2 * p}]);
            }
        }

        var rect = root.insert("rect", ":first-child")
            .classed("shape", true)
            .attr("rx", Math.min(width, height) / 5)
            .attr("ry", Math.min(width, height) / 5)
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", pt + bh + p);

        root.attr("transform", "translate(" + (-width / 2) + "," + (-height / 2) + ")");

        node.width = width;
        node.height = height;

        view.intersect = function (point, direction) {
            if (direction === "in") {
                if (layout === "LR") {
                    return [{x: node.x - node.width / 2, y: node.y}];
                } else {
                    return [{x: node.x, y: node.y - node.height / 2}];
                }
            }
            return intersectRect(node, point);
        };

        return view;
    }


    function renderMapState(root, node, layout) {
        var view = {};

        var p = 20;
        var pt = 20;

        var nestedRectOffset = 5;
        var nestedRectCount = 3;

        var branchesRoot = root.append("g").classed("branches", true);

        var iteratorDefinition = node.state.Iterator;
        var branchRoot = branchesRoot.append("g").classed("branch", true);

        var branchGraph = renderBranch(branchRoot, iteratorDefinition, false, layout);
        var branchBbox = branchRoot.node().getBBox();
        var iterator = {
            dx: 0,
            height: branchBbox.height,
            width: branchBbox.width,
            startNode: branchGraph.node("state-" + iteratorDefinition.StartAt)
        };

        branchRoot.attr("transform", "translate(0,0)");
        branchesRoot.attr("transform", "translate(" + p + "," + pt + ")");

        var branchesBbox = branchesRoot.node().getBBox();
        var bw = branchesBbox.width;
        var bh = branchesBbox.height;
        var width = 2 * p + bw;
        var height = pt + bh + p;

        if (layout === "LR") {
            renderArrow(root, [{x: 0, y: height / 2}, {x: p / 2, y: height / 2},
                {x: p / 2, y: p + iterator.dy + iterator.startNode.y},
                {x: p, y: p + iterator.dy + iterator.startNode.y}]);
        } else {
            renderArrow(root,
                [{x: width / 2, y: 0}, {x: width / 2, y: p / 2}, {x: p + iterator.dx + iterator.startNode.x, y: p / 2},
                    {x: p + iterator.dx + iterator.startNode.x, y: p}]);
        }

        for (var i = 0; i < nestedRectCount; i++) {
            root.insert("rect", ":first-child")
                .classed("shape", true)
                .attr("rx", 5)
                .attr("ry", 5)
                .attr("x", i * -nestedRectOffset)
                .attr("y", i * -nestedRectOffset)
                .attr("width", width - i)
                .attr("height", pt + bh + p - i);
        }

        root.attr("transform", "translate(" + (-width / 2) + "," + (-height / 2) + ")");

        node.width = width + (nestedRectOffset * nestedRectCount);
        node.height = height;

        view.intersect = function (point, direction) {
            if (direction === "in") {
                if (layout === "LR") {
                    return [{x: node.x - node.width / 2, y: node.y}];
                } else {
                    return [{x: node.x, y: node.y - node.height / 2}];
                }
            }
            return intersectRect(node, point);
        };

        return view;
    }

    var idCounter = 0;

    function uniqueId(prefix) {
        var id = ++idCounter;
        return prefix + id;
    }

    function renderArrow(root, points, showArrowHead) {
        var arrowheadId = uniqueId("arrowhead");

        root.append("path")
            .classed("path", true)
            .style("fill", "none")
            .attr("marker-end", "url(#" + arrowheadId + ")")
            .attr("d", function () {
                return d3.svg.line()
                    .x(function (d) {
                        return d.x;
                    })
                    .y(function (d) {
                        return d.y;
                    })
                    .interpolate("basis")(points);
            });

        if (showArrowHead) {
            root.append("defs")
                .append("marker")
                .attr("id", arrowheadId)
                .attr("viewBox", "0 0 10 10")
                .attr("refX", 9)
                .attr("refY", 5)
                .attr("markerUnits", "strokeWidth")
                .attr("markerWidth", 8)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M 0 0 L 10 5 L 0 10 z");
        }
    }

    function renderEdge(edgeRoot, edge, fromNode, toNode) {
        var points = [];

        if (fromNode.view.intersect) {
            var nextPoint = edge.points[1];
            var outIntersect = fromNode.view.intersect(nextPoint, "out");
            for (var i = 0; i < outIntersect.length; i++) {
                points.push(outIntersect[i]);
            }
        } else {
            points.push(edge.points[0]);
        }

        for (var j = 1; j < edge.points.length - 1; j++) {
            points.push(edge.points[j]);
        }

        if (toNode.view.intersect) {
            var previousPoint = edge.points[edge.points.length - 2];
            var inIntersect = toNode.view.intersect(previousPoint, "in").reverse();
            for (var k = 0; k < inIntersect.length; k++) {
                points.push(inIntersect[k]);
            }
        } else {
            points.push(edge.points[edge.points.length - 1]);
        }

        renderArrow(edgeRoot, points, true);
    }

    function createNodesAndEdges(branch, createAnchors, layout) {
        var g = new dagreD3.graphlib.Graph().setGraph({ranksep: 25, edgesep: 30, nodesep: 40, rankdir: layout});

        if (createAnchors) {
            g.setNode("start", {renderer: renderStartNode});
            g.setNode("end", {renderer: renderEndNode});
        }

        for (var stateName in branch.States) {
            var state = branch.States[stateName];
            var id = "state-" + stateName;

            g.setNode(id, {
                renderer: renderStateNode, stateName: stateName, state: state,
            });

            var next = getAllNextStates(state);
            for (var j = 0; j < next.length; j++) {
                g.setEdge(id, "state-" + next[j], {});
            }

            if (createAnchors && branch.StartAt === stateName) {
                g.setEdge("start", id, {});
            }

            if (createAnchors && (state.End || state.Type === "Succeed" || state.Type === "Fail")) {
                g.setEdge(id, "end", {});
            }
        }

        return g;
    }

    function renderBranch(root, branch, createAnchors, layout) {
        var graph = createNodesAndEdges(branch, createAnchors, layout);

        // create the nodes
        var nodeContainers = root.append("g").classed("nodes", true).selectAll("g.node-container")
            .data($.map(graph.nodes(), function (x) {
                return graph.node(x);
            }))
            .enter()
            .append("g").classed("node-container", true);
        nodeContainers.append("g").classed("node", true)
            .each(function (node) {
                var nodeRoot = d3.select(this);
                node.view = node.renderer(nodeRoot, node, layout);
            });

        // compute the layout
        dagreD3.dagre.layout(graph);

        // position the nodes
        nodeContainers.attr("transform", function (node) {
            return "translate(" + node.x + "," + node.y + ")";
        });

        // create the edges
        root.append("g").classed("edges", true).selectAll("g.edge")
            .data(graph.edges())
            .enter()
            .append("g")
            .classed("edge", true)
            .each(function (e) {
                var edge = graph.edge(e);
                var fromNode = graph.node(e.v);
                var toNode = graph.node(e.w);
                var edgeRoot = d3.select(this);
                renderEdge(edgeRoot, edge, fromNode, toNode);
            });

        return graph;
    }

    function getAllNextStates(state) {
        var transitions = [];
        if (state.Next) {
            transitions.push(state.Next);
        }
        if (state.Catch) {
            for (var i = 0; i < state.Catch.length; i++) {
                var catchClause = state.Catch[i];
                if (catchClause.Next) {
                    transitions.push(catchClause.Next);
                }
            }
        }
        if (state.Choices) {
            for (var j = 0; j < state.Choices.length; j++) {
                var choice = state.Choices[j];
                if (choice.Next) {
                    transitions.push(choice.Next);
                }
            }
        }
        if (state.Default) {
            transitions.push(state.Default);
        }
        return transitions;
    }

    /*
     * Set the size of the svg element according to the options provided and the proportions
     * of the rendered graph, then scale and center the graph within the svg canvas.
     *
     * Options: {
     *     width: number,
     *     height: number,
     *     maxWidth: number,
     *     maxHeight: number
     * }
     */
    function fitGraph(svg, options) {
        var graphRoot = svg.select("g");

        // Dagre has a bug that makes it position nodes too close to the borders and they can sometimes
        // overflow the bounds of the graph by a few pixels. We add some padding to mitigate the issue.
        var padding = 40;

        // The dimensions of the rendered graph.
        var bbox = graphRoot.node().getBBox();
        var graphWidth = bbox.width + 2 * padding;
        var graphHeight = bbox.height + 2 * padding;

        // Compute the scaling factor to fit the rendered graph within the maximum or target bounds.
        var scalingX = 1;
        var scalingY = 1;
        if (graphWidth > (options.width || options.maxWidth)) {
            scalingX = (options.width || options.maxWidth) / graphWidth;
        }
        if (graphHeight > (options.height || options.maxHeight)) {
            scalingY = (options.height || options.maxHeight) / graphHeight;
        }
        var scaling = Math.min(scalingX, scalingY);

        // Set the size of the svg element.
        var svgWidth = options.width || graphWidth * scaling;
        var svgHeight = options.height || graphHeight * scaling;

        if (!options.resizeGraph) {
            svg.attr("width", svgWidth);
            svg.attr("height", svgHeight);
        }

        // Center the graph within the svg canvas.
        var dx = (svgWidth - (graphWidth * scaling)) / 2 + padding * scaling;
        var dy = (svgHeight - (graphHeight * scaling)) / 2 + padding * scaling;
        graphRoot.attr("transform", "translate(" + [dx, dy] + ") scale(" + scaling + ")");


        svg.call(d3.behavior.drag().on("drag", function () {
            transformGraph(graphRoot, d3.event.dx, d3.event.dy, 0);
        }));

        return {
            dx: dx, dy: dy, scaling: scaling
        };
    }

    function transformGraph(graph, translateX, translateY, scaleDiff) {
        var t = d3.transform(graph.attr("transform")), translate = t.translate, scale = t.scale;
        var scaling = Math.min(scale[0], scale[1]);
        graph.attr("transform",
            "translate ( " + [translate[0] + translateX, translate[1] + translateY] + ") scale(" + scaling *
            (1 + scaleDiff) + ")");
    }

    /**
     * Workflow Graph Directive.
     *
     * Usage example:
     * <workflow-graph definition="..." latest-state-instances="..." interactive="true" node-callback="..." />
     *
     * Draws a graph representation of a workflow using the Dagre library.
     *
     * Attributes:
     *    definition:   (object)   The ASL definition.
     *    resize-graph:   (boolean)  Whether to resize the graph to fit the bounds.
     *    interactive:  (boolean)  Whether to react to hovers and clicks on the graph elements.
     *    nodeCallback: (function) A function to invoke when a node is clicked. The corresponding node object will be passed as parameter (see createNodesAndEdges()).
     *    latest-state-instances:  (object)  A map of state names to the latest state instance of that state (see AwsSimpleWorkflowService.computeLatestStateInstances()).
     */
    module.directive("workflowGraph", ["$window", function ($window) {
        function getGraphSVGContainer(element) {
            return d3.select(element.find("svg.sfn-workflow-graph")[0]);
        }

        function getGraphRoot(element) {
            var svg = getGraphSVGContainer(element);
            return svg.select("g");
        }

        var windowElement = angular.element($window);

        return {
            restrict: "E", scope: {
                definition: "=",
                latestStateInstances: "=",
                nodeCallback: "&nodeCallback",
                interactive: "@",
                resizeGraph: "@",
                showLegend: "<",
                nodeDirection: "=?",
            }, transclude: {
                topControls: "?sfnGraphTopControls", bottomControls: "?sfnGraphBottomControls",
            }, templateUrl: "/partials/workflowGraph.html", link: function (scope, elem, attrs) {
                if (angular.isUndefined(scope.nodeDirection)) {
                    scope.nodeDirection = "TB";
                }

                var parentNode = elem.parent();
                scope.centerGraph = function () {
                    resetGraph();
                };

                scope.zoomInGraph = function () {
                    transformGraph(getGraphRoot(elem), 0, 0, 0.4);
                };

                scope.zoomOutGraph = function () {
                    transformGraph(getGraphRoot(elem), 0, 0, -0.4);
                };

                windowElement.on("resize", resetGraph);
                scope.$on("$destroy", function () {
                    windowElement.off("resize", resetGraph);
                });
                scope.$on("changeOrientation", resetGraph);
                scope.$on("centerGraph", resetGraph);

                function clearGraph() {
                    var svg = getGraphSVGContainer(elem);
                    svg.selectAll("*").remove();
                }

                function showScrollMessage() {
                    var scrollMessage = elem.find(".workflow-graph-scroll-message");
                    scrollMessage.stop(true);
                    scrollMessage.fadeIn().delay(3000).fadeOut();
                }

                function renderGraph(definition, selectedState) {
                    var svg = getGraphSVGContainer(elem);
                    svg.selectAll("*").remove();
                    var graphRoot = svg.append("g");

                    // Layout and render the graph.
                    renderBranch(graphRoot, definition, true, scope.nodeDirection);

                    var legendHeight = scope.showLegend ? elem.find(".sfn-workflow-legend").height() : 0;

                    var fitTransform = fitGraph(svg, {
                        height: elem.parent().height() - legendHeight,
                        width: elem.parent().width(),
                        maxHeight: parentNode.height() - legendHeight,
                        resizeGraph: scope.resizeGraph
                    });

                    // enable scroll to zoom while Ctrl or Cmd is pressed
                    svg.call(d3.behavior.zoom().on("zoom", function () {
                        var sourceEvent = d3.event.sourceEvent;
                        if (sourceEvent && (sourceEvent.ctrlKey || sourceEvent.metaKey)) {
                            graphRoot.attr("transform", "translate(" +
                                [fitTransform.dx + d3.event.translate[0], fitTransform.dy + d3.event.translate[1]] +
                                ") scale(" + (fitTransform.scaling * d3.event.scale) + ")");
                        } else
                            if (sourceEvent instanceof WheelEvent) {
                                // Default action is prevented by d3. Allow window to scroll normally
                                scope.$emit("sfn:pageLayout-scroll", {offset: sourceEvent.deltaY});
                                showScrollMessage();
                            } else
                                if (window.MouseWheelEvent && (sourceEvent instanceof window.MouseWheelEvent)) {
                                    // IE11 fires a MouseWheelEvent which does not allow scrolling
                                    showScrollMessage();
                                }
                    }));

                    if (scope.interactive) {
                        // Add mouseup events to each STATE node in the graph.
                        svg.select("g.nodes").selectAll(".node.state")
                            .each(function (d) {
                                if (d.stateName === selectedState) {
                                    var node = d3.select(this);
                                    node.classed("selected", true);
                                }
                            })
                            .on("mouseup", function (d, event) {
                                var node = d3.select(this);
                                if (!d3.event.handled) {
                                    // events are propagated in parent elements, this ensure we only run this for the inner-most element.
                                    d3.event.handled = true;
                                    if (!node.classed("NotYetStarted")) {
                                        graphRoot.selectAll(".node.selected").classed("selected", false);
                                        node.classed("selected", true);

                                        if (scope.nodeCallback !== null) {
                                            scope.$applyAsync(function () {
                                                scope.nodeCallback()(d.stateName);
                                            });
                                        }
                                    }
                                }
                            })
                            .on("mouseover", function (d, event) {
                                var node = d3.select(this);
                                if (!d3.event.handled) {
                                    d3.event.handled = true;
                                    graphRoot.selectAll(".node.hovered").classed("hovered", false);
                                    node.classed("hovered", true);
                                }
                            });

                        // Unselect/hover when clicking/hovering out of graph elements.
                        svg.on("mouseup", function (d, event) {
                            if (!d3.event.handled) {
                                graphRoot.selectAll(".node.selected").classed("selected", false);
                                if (scope.nodeCallback !== null) {
                                    scope.$applyAsync(function () {
                                        scope.nodeCallback()();
                                    });
                                }
                            }
                        })
                            .on("mouseover", function (d, event) {
                                if (!d3.event.handled) {
                                    d3.event.handled = true;
                                    graphRoot.selectAll(".node.hovered").classed("hovered", false);
                                }
                            });
                    }
                }

                function colorGraph() {
                    if (scope.latestStateInstances) {
                        var svg = getGraphSVGContainer(elem);
                        svg.selectAll(".node.state").each(function (node) {
                            var latestStateInstance = scope.latestStateInstances[node.stateName];
                            var status = "NotYetStarted";
                            if (latestStateInstance) {
                                status = latestStateInstance.status;
                            }
                            d3.select(this)
                                .classed("NotYetStarted", false)
                                .classed("Succeeded", false)
                                .classed("Failed", false)
                                .classed("Cancelled", false)
                                .classed("InProgress", false)
                                .classed("CaughtError", false)
                                .classed(status, true);
                        });
                    }
                }

                // Repaint the graph with existing state selected(if any)
                function resetGraph(event, selectedState) {
                    if (scope.definition) {
                        renderGraph(scope.definition, selectedState);
                        colorGraph();
                    }
                }

                scope.$watchGroup(["definition", "nodeDirection"], function () {
                    try {
                        if (scope.definition === "") {
                            clearGraph();
                        } else
                            if (scope.definition) {
                                renderGraph(scope.definition);
                            }
                        colorGraph();
                        scope.error = null;
                    } catch (e) {
                        console.error(e);
                        scope.error = e;
                    }
                }, true);

                scope.$watch("latestStateInstances", function () {
                    try {
                        colorGraph();
                        scope.error = null;
                    } catch (e) {
                        console.error(e);
                        scope.error = e;
                    }
                }, true);
            }
        };
    }]);
}());
