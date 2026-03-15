/**
 * Armenian OSINT — Network Graph
 * SVG force-directed visualization of company relationships
 * Pure JS + SVG, no external dependencies
 */

const INDUSTRY_COLORS = {
    'Information Technology': '#6366f1',
    'Banking & Finance':      '#10b981',
    'Telecommunications':     '#f59e0b',
    'Energy & Utilities':     '#ef4444',
    'Food & Beverage':        '#8b5cf6',
    'Mining':                 '#ec4899',
    'Transportation':         '#14b8a6',
    'Healthcare':             '#f97316',
    'Conglomerate':           '#06b6d4',
    'Real Estate':            '#84cc16',
}

function industryColor(industry) {
    return INDUSTRY_COLORS[industry] || '#9ca3af'
}

class NetworkGraph {
    constructor(svgEl) {
        this.svg = svgEl
        this.allNodes = []
        this.allEdges = []
        this.nodes = []
        this.edges = []
        this.running = false
        this.dragging = null
        this.transform = { x: 0, y: 0, scale: 1 }
        this.panning = null
        this._rafId = null
        this._setupInteraction()
    }

    load(nodes, edges) {
        this.allNodes = nodes
        this.allEdges = edges
        this.applyFilter('')
    }

    applyFilter(industry) {
        const ids = new Set(
            industry
                ? this.allNodes.filter(n => n.group === industry).map(n => n.id)
                : this.allNodes.map(n => n.id)
        )
        this.nodes = this.allNodes
            .filter(n => ids.has(n.id))
            .map(n => ({ ...n, x: this._w() / 2 + (Math.random() - 0.5) * this._w() * 0.7, y: this._h() / 2 + (Math.random() - 0.5) * this._h() * 0.7, vx: 0, vy: 0 }))
        this.edges = this.allEdges.filter(e => ids.has(e.source) && ids.has(e.target))
        this._buildDOM()
        this.restart()
    }

    _w() { return this.svg.clientWidth || 900 }
    _h() { return this.svg.clientHeight || 600 }

    _buildDOM() {
        this.svg.innerHTML = `
            <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="#c7d2fe"/>
                </marker>
            </defs>
            <g id="graph-root" transform="translate(0,0) scale(1)">
                <g id="edges-layer"></g>
                <g id="nodes-layer"></g>
            </g>`

        const edgesLayer = this.svg.querySelector('#edges-layer')
        const nodesLayer = this.svg.querySelector('#nodes-layer')

        // Create edge elements
        this._edgeEls = {}
        for (const e of this.edges) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            line.setAttribute('class', 'graph-edge')
            line.setAttribute('stroke', e.type === 'same_industry' ? '#c7d2fe' : '#e5e7eb')
            line.setAttribute('stroke-width', e.type === 'same_industry' ? '1.5' : '1')
            line.setAttribute('opacity', '0.6')
            edgesLayer.appendChild(line)
            this._edgeEls[`${e.source}-${e.target}`] = line
        }

        // Create node elements
        this._nodeEls = {}
        const tooltip = document.getElementById('graph-tooltip')

        for (const n of this.nodes) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            g.setAttribute('class', 'graph-node')
            g.setAttribute('cursor', 'pointer')

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            circle.setAttribute('r', n.size || 10)
            circle.setAttribute('fill', industryColor(n.group))
            circle.setAttribute('stroke', '#fff')
            circle.setAttribute('stroke-width', '2')

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            text.setAttribute('text-anchor', 'middle')
            text.setAttribute('dy', (n.size || 10) + 12)
            text.setAttribute('font-size', '10')
            text.setAttribute('fill', '#6b7280')
            text.setAttribute('pointer-events', 'none')
            text.textContent = n.name.length > 18 ? n.name.slice(0, 16) + '…' : n.name

            g.appendChild(circle)
            g.appendChild(text)
            nodesLayer.appendChild(g)
            this._nodeEls[n.id] = g

            // Drag
            g.addEventListener('mousedown', (e) => { e.stopPropagation(); this.dragging = n })

            // Tooltip
            g.addEventListener('mouseenter', (ev) => {
                if (!tooltip) return
                tooltip.style.display = 'block'
                tooltip.innerHTML = `<strong>${n.name}</strong><br>${n.group || ''}<br>${n.city || ''}<br>Employees: ${n.size ? Math.round(n.size * n.size) : '?'}`
            })
            g.addEventListener('mousemove', (ev) => {
                if (!tooltip) return
                const rect = this.svg.getBoundingClientRect()
                tooltip.style.left = (ev.clientX - rect.left + 12) + 'px'
                tooltip.style.top = (ev.clientY - rect.top - 10) + 'px'
            })
            g.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none' })
        }
    }

    _render() {
        const root = this.svg.querySelector('#graph-root')
        if (root) root.setAttribute('transform', `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.scale})`)

        for (const n of this.nodes) {
            const el = this._nodeEls[n.id]
            if (el) el.setAttribute('transform', `translate(${n.x},${n.y})`)
        }
        for (const e of this.edges) {
            const el = this._edgeEls[`${e.source}-${e.target}`]
            if (!el) continue
            const a = this.nodes.find(n => n.id === e.source)
            const b = this.nodes.find(n => n.id === e.target)
            if (a && b) {
                el.setAttribute('x1', a.x); el.setAttribute('y1', a.y)
                el.setAttribute('x2', b.x); el.setAttribute('y2', b.y)
            }
        }
    }

    _tick() {
        const W = this._w(), H = this._h()
        const charge = 3000, spring = 0.04, restLen = 100, damp = 0.82

        // Repulsion between all pairs
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const a = this.nodes[i], b = this.nodes[j]
                const dx = b.x - a.x, dy = b.y - a.y
                const dist = Math.max(Math.hypot(dx, dy), 1)
                const f = charge / (dist * dist)
                const fx = (dx / dist) * f, fy = (dy / dist) * f
                a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy
            }
        }

        // Spring attraction along edges
        for (const e of this.edges) {
            const a = this.nodes.find(n => n.id === e.source)
            const b = this.nodes.find(n => n.id === e.target)
            if (!a || !b) continue
            const dx = b.x - a.x, dy = b.y - a.y
            const dist = Math.max(Math.hypot(dx, dy), 1)
            const f = spring * (dist - restLen) * (e.weight || 1)
            const fx = (dx / dist) * f, fy = (dy / dist) * f
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
        }

        // Gravity toward center + integrate
        for (const n of this.nodes) {
            if (this.dragging === n) continue
            n.vx += (W / 2 - n.x) * 0.0008
            n.vy += (H / 2 - n.y) * 0.0008
            n.vx *= damp; n.vy *= damp
            n.x = Math.max(30, Math.min(W - 30, n.x + n.vx))
            n.y = Math.max(30, Math.min(H - 30, n.y + n.vy))
        }
    }

    restart() {
        this.stop()
        this.running = true
        let iter = 0
        const loop = () => {
            if (!this.running) return
            this._tick()
            this._render()
            iter++
            // Slow down after 200 iterations if kinetic energy is low
            const ke = this.nodes.reduce((s, n) => s + n.vx * n.vx + n.vy * n.vy, 0)
            if (iter < 300 || ke > 0.5) {
                this._rafId = requestAnimationFrame(loop)
            } else {
                this.running = false
            }
        }
        this._rafId = requestAnimationFrame(loop)
    }

    stop() {
        this.running = false
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null }
    }

    _setupInteraction() {
        // Mouse drag on nodes (handled per node) + pan on SVG background
        this.svg.addEventListener('mousemove', (e) => {
            if (this.dragging) {
                const rect = this.svg.getBoundingClientRect()
                const s = this.transform.scale
                this.dragging.x = (e.clientX - rect.left - this.transform.x) / s
                this.dragging.y = (e.clientY - rect.top - this.transform.y) / s
                this.dragging.vx = 0; this.dragging.vy = 0
                if (!this.running) this._render()
            } else if (this.panning) {
                this.transform.x += e.clientX - this.panning.x
                this.transform.y += e.clientY - this.panning.y
                this.panning = { x: e.clientX, y: e.clientY }
                if (!this.running) this._render()
            }
        })

        this.svg.addEventListener('mousedown', (e) => {
            if (e.target === this.svg || e.target.tagName === 'g' && e.target.id === 'graph-root') {
                this.panning = { x: e.clientX, y: e.clientY }
            }
        })

        this.svg.addEventListener('mouseup', () => { this.dragging = null; this.panning = null })
        this.svg.addEventListener('mouseleave', () => { this.dragging = null; this.panning = null })

        // Scroll to zoom
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault()
            const delta = e.deltaY > 0 ? 0.9 : 1.1
            this.transform.scale = Math.max(0.2, Math.min(4, this.transform.scale * delta))
            if (!this.running) this._render()
        }, { passive: false })
    }

    resetLayout() {
        this.transform = { x: 0, y: 0, scale: 1 }
        this.nodes.forEach(n => {
            n.x = this._w() / 2 + (Math.random() - 0.5) * this._w() * 0.7
            n.y = this._h() / 2 + (Math.random() - 0.5) * this._h() * 0.7
            n.vx = 0; n.vy = 0
        })
        this.restart()
    }

    buildLegend() {
        const industries = [...new Set(this.allNodes.map(n => n.group).filter(Boolean))]
        const legend = document.getElementById('graph-legend')
        if (!legend) return
        legend.innerHTML = industries.map(ind => `
            <div class="legend-item">
                <span class="legend-dot" style="background:${industryColor(ind)}"></span>
                <span class="legend-label">${ind}</span>
            </div>`).join('')

        const select = document.getElementById('graph-filter')
        if (select) {
            select.innerHTML = '<option value="">All industries</option>' +
                industries.map(ind => `<option value="${ind}">${ind}</option>`).join('')
        }
    }
}
