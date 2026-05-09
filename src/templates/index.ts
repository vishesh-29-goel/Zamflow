import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../store/types';

function makeNode(id: string, type: string, label: string, x: number, y: number, extra: Partial<NodeData> = {}): Node<NodeData> {
  return {
    id, type,
    position: { x, y },
    data: { label, nodeType: type as any, color: '#fff', borderColor: '#6366f1', fontSize: 13, notes: '', metadata: {}, ...extra },
    style: { width: 160, height: type === 'decision' ? 80 : 60 }
  };
}
function makeEdge(id: string, source: string, target: string, label = '', extra: Partial<EdgeData> = {}): Edge<EdgeData> {
  return { id, source, target, label, type: 'custom', data: { edgeType: 'smoothstep', thickness: 2, color: '#6366f1', arrow: true, ...extra } };
}

export const TEMPLATES: Record<string, { name: string; description: string; nodes: Node<NodeData>[]; edges: Edge<EdgeData>[] }> = {
  decision_tree: {
    name: 'Decision Tree',
    description: 'A simple binary decision tree template',
    nodes: [
      makeNode('s1','start','Start',300,50),
      makeNode('d1','decision','Decision?',250,150),
      makeNode('p1','process','Option A',100,280),
      makeNode('p2','process','Option B',420,280),
      makeNode('e1','end','End A',100,400),
      makeNode('e2','end','End B',420,400),
    ],
    edges: [
      makeEdge('e1','s1','d1'),
      makeEdge('e2','d1','p1','Yes'),
      makeEdge('e3','d1','p2','No'),
      makeEdge('e4','p1','e1'),
      makeEdge('e5','p2','e2'),
    ]
  },
  approval_workflow: {
    name: 'Approval Workflow',
    description: 'Standard approval process with escalation',
    nodes: [
      makeNode('s1','start','Request Submitted',300,30),
      makeNode('p1','process','Review Request',300,130),
      makeNode('d1','decision','Approved?',300,230),
      makeNode('p2','process','Process Approval',300,340),
      makeNode('p3','process','Return for Revision',100,340),
      makeNode('d2','decision','Escalate?',500,230),
      makeNode('p4','process','Escalate to Manager',500,340),
      makeNode('e1','end','Complete',300,450),
    ],
    edges: [
      makeEdge('e1','s1','p1'),
      makeEdge('e2','p1','d1'),
      makeEdge('e3','d1','p2','Yes'),
      makeEdge('e4','d1','p3','No'),
      makeEdge('e5','d1','d2','Escalate'),
      makeEdge('e6','d2','p4','Yes'),
      makeEdge('e7','p2','e1'),
      makeEdge('e8','p3','p1'),
      makeEdge('e9','p4','e1'),
    ]
  },
  escalation_process: {
    name: 'Escalation Process',
    description: 'Issue escalation workflow',
    nodes: [
      makeNode('s1','start','Issue Raised',300,30),
      makeNode('p1','process','L1 Support',300,130),
      makeNode('d1','decision','Resolved?',300,230),
      makeNode('p2','process','L2 Support',300,340),
      makeNode('d2','decision','Resolved?',300,440),
      makeNode('p3','process','L3 / Manager',300,550),
      makeNode('e1','end','Issue Closed',300,650),
    ],
    edges: [
      makeEdge('e1','s1','p1'),
      makeEdge('e2','p1','d1'),
      makeEdge('e3','d1','e1','Yes'),
      makeEdge('e4','d1','p2','No'),
      makeEdge('e5','p2','d2'),
      makeEdge('e6','d2','e1','Yes'),
      makeEdge('e7','d2','p3','No'),
      makeEdge('e8','p3','e1'),
    ]
  },
  incident_response: {
    name: 'Incident Response',
    description: 'IT incident response procedure',
    nodes: [
      makeNode('s1','start','Alert Triggered',300,30),
      makeNode('p1','process','Triage Incident',300,130),
      makeNode('d1','decision','Severity?',300,230),
      makeNode('p2','process','Low: Log & Monitor',100,340),
      makeNode('p3','process','High: Engage Team',300,340),
      makeNode('p4','process','Critical: War Room',500,340),
      makeNode('p5','process','Investigate & Mitigate',300,460),
      makeNode('p6','process','Post-mortem',300,560),
      makeNode('e1','end','Resolved',300,660),
    ],
    edges: [
      makeEdge('e1','s1','p1'),
      makeEdge('e2','p1','d1'),
      makeEdge('e3','d1','p2','Low'),
      makeEdge('e4','d1','p3','High'),
      makeEdge('e5','d1','p4','Critical'),
      makeEdge('e6','p2','e1'),
      makeEdge('e7','p3','p5'),
      makeEdge('e8','p4','p5'),
      makeEdge('e9','p5','p6'),
      makeEdge('e10','p6','e1'),
    ]
  },
  sop_workflow: {
    name: 'SOP Workflow',
    description: 'Standard Operating Procedure template',
    nodes: [
      makeNode('s1','start','Begin SOP',300,30),
      makeNode('p1','process','Step 1: Preparation',300,130),
      makeNode('p2','process','Step 2: Execution',300,230),
      makeNode('d1','decision','Quality Check',300,340),
      makeNode('p3','process','Step 3: Review',300,450),
      makeNode('p4','process','Rework Required',100,450),
      makeNode('db1','database','Log Results',500,450),
      makeNode('doc1','document','Generate Report',300,560),
      makeNode('e1','end','SOP Complete',300,660),
    ],
    edges: [
      makeEdge('e1','s1','p1'),
      makeEdge('e2','p1','p2'),
      makeEdge('e3','p2','d1'),
      makeEdge('e4','d1','p3','Yes'),
      makeEdge('e5','d1','p4','No'),
      makeEdge('e6','p4','p2'),
      makeEdge('e7','p3','db1'),
      makeEdge('e8','p3','doc1'),
      makeEdge('e9','db1','e1'),
      makeEdge('e10','doc1','e1'),
    ]
  }
};
