import * as d3 from "d3";
import dagreD3 from "dagre-d3";
import * as echarts from "echarts";

(function () {
    // Create a new directed graph
    const g = new dagreD3.graphlib.Graph({compound: true}).setGraph({})
        .setDefaultEdgeLabel(function () {
            return {};
        });

    const data = {
        nodes: [{id: null, parentId: null, name: "All", startTime: 1609669658000, endTime: 1609669670000},
            {id: "1-1", parentId: null, name: "1-1", startTime: 1609669658000, endTime: 1609669660000},
            {id: "1-2", parentId: null, name: "1-2", startTime: 1609669660000, endTime: 1609669667000},
            {id: "1-3", parentId: null, name: "1-3", startTime: 1609669667000, endTime: 1609669670000},
            {id: "2-1", parentId: "1-1", name: "2-1", startTime: 1609669658000, endTime: 1609669659000},
            {id: "2-2", parentId: "1-1", name: "2-2", startTime: 1609669659000, endTime: 1609669660000},
            {id: "2-3", parentId: "1-1", name: "2-3", startTime: 1609669659000, endTime: 1609669660000},
            {id: "3-1", parentId: "1-2", name: "3-1", startTime: 1609669660000, endTime: 1609669662000},
            {id: "3-2", parentId: "1-2", name: "3-2", startTime: 1609669662000, endTime: 1609669664000},
            {id: "3-3", parentId: "1-2", name: "3-3", startTime: 1609669664000, endTime: 1609669667000},
            {id: "4-1", parentId: "1-3", name: "4-1", startTime: 1609669667000, endTime: 1609669668000},
            {id: "4-2", parentId: "1-3", name: "4-2", startTime: 1609669668000, endTime: 1609669670000},
            {id: "4-3", parentId: "1-3", name: "4-3", startTime: 1609669668000, endTime: 1609669669000}],
        edges: [["2-1", "2-2"], ["2-1", "2-3"], ["3-1", "3-2"], ["3-2", "3-3"], ["4-1", "4-2"], ["4-1", "4-3"],]
    }

    for (let node of data.nodes) {
        g.setNode(node.id, {label: node.name, clusterLabelPos: 'top',})
    }

    for (let node of data.nodes) {
        if (node.parentId) {
            g.setParent(node.id, node.parentId);
        }
    }

    for (let edge of data.edges) {
        g.setEdge(edge[0], edge[1]);
    }

    const svg = d3.select("svg"), inner = svg.select("g");

    // Set up zoom support
    const zoom = d3.zoom().on("zoom", function (e) {
        inner.attr("transform", e.transform);
    });
    svg.call(zoom);

    // Create the renderer
    const render = new dagreD3.render();

    // Run the renderer. This is what draws the final graph.
    render(inner, g);

    // Center the graph
    const initialScale = 0.75;
    svg.call(zoom.transform,
        d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));

    svg.attr('height', g.graph().height * initialScale + 40);

    //
    //
    // **********************
    //
    //

    const myChart = echarts.init(document.getElementById("gantt"));

    function clipRectByRect(params, rect) {
        return echarts.graphic.clipRectByRect(rect, {
            x: params.coordSys.x,
            y: params.coordSys.y,
            width: params.coordSys.width,
            height: params.coordSys.height
        });
    }

    function clipPointsByRect(params, points) {
        return echarts.graphic.clipPointsByRect(points, {
            x: params.coordSys.x,
            y: params.coordSys.y,
            width: params.coordSys.width,
            height: params.coordSys.height
        });
    }

    // 指定图表的配置项和数据
    const option = {
        grid: {show: true},
        dataZoom: [{
            type: 'slider',
            filterMode: 'weakFilter',
            height: 15,
            bottom: 10,
            start: 0,
            end: 100,
            handleIcon: 'M10.7,11.9H9.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
        }, {
            type: 'inside',
            id: 'insideX',
            filterMode: 'weakFilter',
            start: 0,
            end: 100,
            zoomOnMouseWheel: false,
            moveOnMouseMove: true
        }],
        xAxis: {
            type: "time",
            splitLine: {show: true},
            splitNumber: 5
        },
        yAxis: {
            type: "category",
            inverse: true,
            splitArea: {show: true}
        },
        dataset: [{source: data.nodes}, {source: data.edges}],
        series: [{
            id: 'gantt',
            type: 'custom',
            renderItem: (params, api) => {
                const categoryIndex = api.value("id");
                const startTime = api.coord([api.value("startTime"), categoryIndex]);
                const endTime = api.coord([api.value("endTime"), categoryIndex]);
                const barLength = endTime[0] - startTime[0];
                const barHeight = api.size([0, 1])[1] * 0.8;
                const x = startTime[0];
                const y = startTime[1] - barHeight / 2;
                const duration = (api.value("endTime") - api.value("startTime")) + " ms";
                const textWidth = echarts.format.getTextRect(duration).width;
                const rectNormal = clipRectByRect(params,
                    {x: x, y: y, width: barLength, height: barHeight});
                const textShorter = barLength > textWidth + 40 && x + barLength >= 180;
                const rectText = clipRectByRect(params,
                    {
                        x: x + (textShorter ? 0 : barLength + 5), y: y,
                        width: textShorter ? barLength : textWidth, height: barHeight
                    });
                const linkShape = api.value('parentId') ? {
                    points: clipPointsByRect(params, [
                        api.coord([api.value("startTime", api.value("parentId")), api.value("parentId")]),
                        api.coord([api.value("startTime", api.value("parentId")), api.value("id")]),
                        api.coord([api.value("startTime"), api.value("id")])
                    ])
                } : null;
                return {
                    type: "group",
                    children: [{
                        type: 'rect',
                        ignore: !rectNormal,
                        shape: rectNormal,
                        style: api.style()
                    }, {
                        type: 'rect',
                        ignore: !rectText,
                        shape: rectText,
                        style: api.style({
                            fill: 'transparent',
                            stroke: 'transparent',
                            text: duration,
                            textFill: textShorter ? '#fff' : '#777'
                        })
                    }, {
                        type: 'polyline',
                        ignore: !linkShape,
                        shape: linkShape
                    }]
                }
            },
            encode: {
                x: ["startTime", "endTime"],
                y: ["id", "parentId"],
                itemId: "id",
                itemName: "name"
            },
            datasetIndex: 0,
        }],
        tooltip: {
            formatter: function (params) {
                return params.marker + params.name + ': ' + (params.value['endTime'] - params.value['startTime']) + ' ms';
            }
        },
    };

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
})();
