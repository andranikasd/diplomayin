/**
 * Armenian OSINT — Network Graph v2
 * Dark-theme force-directed SVG visualization
 * Features: search, zoom controls, click detail panel, industry clustering, touch support
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
function industryColor(g) { return INDUSTRY_COLORS[g] || '#64748b' }

function fmtRevenue(r) {
    if (!r) return null
    if (r >= 1e9) return `$${(r / 1e9).toFixed(1)}B`
    if (r >= 1e6) return `$${(r / 1e6).toFixed(0)}M`
    return `$${(r / 1e3).toFixed(0)}K`
}
function fmtNum(n) { return n ? Number(n).toLocaleString() : '—' }

class NetworkGraph {
    constructor(svgEl) {
        this.svg      = svgEl
        this.allNodes = []
        this.allEdges = []
        this.nodes    = []
        this.edges    = []
        this.nodeMap  = {}          // id → node
        this.running  = false
        this.dragging = null
        this.panning  = null
        this.selected = null
        this.transform = { x: 0, y: 0, scale: 1 }
        this._rafId   = null
        this._searchTerm = ''
        this._setupInteraction()
    }

    // ── Public API ───────────────────────────────────────────────

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
        const W = this._w(), H = this._h()
        this.nodes = this.allNodes
            .filter(n => ids.has(n.id))
            .map(n => ({
                ...n,
                x: W / 2 + (Math.random() - 0.5) * W * 0.6,
                y: H / 2 + (Math.random() - 0.5) * H * 0.6,
                vx: 0, vy: 0,
                highlighted: false, dimmed: false,
            }))
        this.edges    = this.allEdges.filter(e => ids.has(e.source) && ids.has(e.target))
        this.nodeMap  = Object.fromEntries(this.nodes.map(n => [n.id, n]))
        this.selected = null
        this._hideDetail()
        this._buildDOM()
        this.restart()
        if (this._searchTerm) this.search(this._searchTerm)
    }

    search(term) {
        this._searchTerm = term.toLowerCase()
        const has = !!this._searchTerm
        this.nodes.forEach(n => {
            const match = !has || n.name.toLowerCase().includes(this._searchTerm)
            n.highlighted = has && match
            n.dimmed = has && !match
        })
        this._applyHighlight()
    }

    zoomBy(factor) {
        const W = this._w(), H = this._h()
        const cx = W / 2, cy = H / 2
        this.transform.x = cx - (cx - this.transform.x) * factor
        this.transform.y = cy - (cy - this.transform.y) * factor
        this.transform.scale = Math.max(0.15, Math.min(5, this.transform.scale * factor))
        this._render()
    }

    resetLayout() {
        this.transform = { x: 0, y: 0, scale: 1 }
        const W = this._w(), H = this._h()
        this.nodes.forEach(n => {
            n.x = W / 2 + (Math.random() - 0.5) * W * 0.6
            n.y = H / 2 + (Math.random() - 0.5) * H * 0.6
            n.vx = 0; n.vy = 0
        })
        this.restart()
    }

    buildLegend() {
        const industries = [...new Set(this.allNodes.map(n => n.group).filter(Boolean))]
        const legend = document.getElementById('graph-legend')
        if (legend) {
            legend.innerHTML = industries.map(ind => `
                <div class="legend-item" data-industry="${ind}" title="Filter: ${ind}">
                    <span class="legend-dot" style="background:${industryColor(ind)}"></span>
                    <span class="legend-label">${ind}</span>
                    <span class="legend-count">${this.allNodes.filter(n => n.group === ind).length}</span>
                </div>`).join('')
            legend.querySelectorAll('.legend-item').forEach(el => {
                el.addEventListener('click', () => {
                    const sel = document.getElementById('graph-filter')
                    const ind = el.dataset.industry
                    if (sel) { sel.value = ind === sel.value ? '' : ind; sel.dispatchEvent(new Event('change')) }
                })
            })
        }
        const select = document.getElementById('graph-filter')
        if (select) {
            select.innerHTML = '<option value="">All industries</option>' +
                industries.map(ind => `<option value="${ind}">${ind}</option>`).join('')
        }
    }

    // ── DOM builder ──────────────────────────────────────────────

    _buildDOM() {
        this.svg.innerHTML = `
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-strong" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <marker id="arr" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto">
                    <polygon points="0 0, 5 2, 0 4" fill="rgba(99,102,241,0.5)"/>
                </marker>
            </defs>
            <g id="graph-root">
                <g id="edges-layer"></g>
                <g id="nodes-layer"></g>
            </g>`

        const edgesLayer = this.svg.querySelector('#edges-layer')
        const nodesLayer = this.svg.querySelector('#nodes-layer')
        const tooltip    = document.getElementById('graph-tooltip')

        // Edges
        this._edgeEls = {}
        for (const e of this.edges) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            line.dataset.type = e.type
            line.setAttribute('class', 'graph-edge')
            edgesLayer.appendChild(line)
            this._edgeEls[`${e.source}-${e.target}`] = line
        }

        // Nodes
        this._nodeEls = {}
        for (const n of this.nodes) {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            g.setAttribute('class', 'graph-node')
            g.setAttribute('cursor', 'pointer')

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            circle.setAttribute('r', n.size || 10)
            circle.setAttribute('fill', industryColor(n.group))
            circle.setAttribute('class', 'node-circle')

            // Inner highlight
            const shine = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            shine.setAttribute('r', (n.size || 10) * 0.45)
            shine.setAttribute('cx', -(n.size || 10) * 0.2)
            shine.setAttribute('cy', -(n.size || 10) * 0.2)
            shine.setAttribute('fill', 'rgba(255,255,255,0.18)')
            shine.setAttribute('pointer-events', 'none')

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            label.setAttribute('class', 'node-label')
            label.setAttribute('text-anchor', 'middle')
            label.setAttribute('dy', (n.size || 10) + 13)
            label.setAttribute('pointer-events', 'none')
            label.textContent = n.name.length > 20 ? n.name.slice(0, 18) + '…' : n.name

            g.appendChild(circle)
            g.appendChild(shine)
            g.appendChild(label)
            nodesLayer.appendChild(g)
            this._nodeEls[n.id] = g

            // Events
            g.addEventListener('mousedown', ev => { ev.stopPropagation(); this.dragging = n })
            g.addEventListener('click',     ev => { ev.stopPropagation(); this._selectNode(n) })
            g.addEventListener('mouseenter', () => {
                if (this.dragging) return
                if (tooltip) {
                    const emp = n.employee_count ? fmtNum(n.employee_count) + ' employees' : ''
                    const rev = fmtRevenue(n.revenue_estimate) ? `· ${fmtRevenue(n.revenue_estimate)}` : ''
                    tooltip.style.display = 'block'
                    tooltip.innerHTML = `<strong>${n.name}</strong><br><span style="color:${industryColor(n.group)}">${n.group}</span><br>${n.city || ''}${emp ? '<br>' + emp + ' ' + rev : ''}`
                }
                circle.setAttribute('filter', 'url(#glow)')
            })
            g.addEventListener('mousemove', ev => {
                if (!tooltip || tooltip.style.display === 'none') return
                const rect = this.svg.getBoundingClientRect()
                tooltip.style.left = (ev.clientX - rect.left + 14) + 'px'
                tooltip.style.top  = (ev.clientY - rect.top  - 10) + 'px'
            })
            g.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none'
                if (this.selected?.id !== n.id) circle.removeAttribute('filter')
            })
        }
        this._applyHighlight()
    }

    // ── Selection / detail panel ─────────────────────────────────

    _selectNode(n) {
        // Deselect previous
        if (this.selected) {
            const prev = this._nodeEls[this.selected.id]
            prev?.querySelector('.node-circle')?.removeAttribute('filter')
            prev?.querySelector('.node-circle')?.setAttribute('stroke', 'rgba(255,255,255,0.4)')
        }
        if (this.selected?.id === n.id) {
            this.selected = null
            this._hideDetail()
            return
        }
        this.selected = n
        const circle = this._nodeEls[n.id]?.querySelector('.node-circle')
        if (circle) {
            circle.setAttribute('filter', 'url(#glow-strong)')
            circle.setAttribute('stroke', '#fff')
        }
        this._showDetail(n)
    }

    _showDetail(n) {
        const panel = document.getElementById('graph-detail')
        if (!panel) return
        const color = industryColor(n.group)
        const year  = n.founded_date ? new Date(n.founded_date).getFullYear() : null
        panel.innerHTML = `
            <button class="graph-detail-close" id="graph-detail-close">×</button>
            <div class="graph-detail-badge" style="background:${color}22;color:${color};border-color:${color}44">${n.group}</div>
            <h3 class="graph-detail-name">${n.name}</h3>
            <div class="graph-detail-rows">
                ${n.city        ? `<div class="gdr"><span>City</span><span>${n.city}</span></div>` : ''}
                ${n.employee_count ? `<div class="gdr"><span>Employees</span><span>${fmtNum(n.employee_count)}</span></div>` : ''}
                ${n.revenue_estimate ? `<div class="gdr"><span>Est. Revenue</span><span>${fmtRevenue(n.revenue_estimate)}</span></div>` : ''}
                ${year          ? `<div class="gdr"><span>Founded</span><span>${year}</span></div>` : ''}
                ${n.website     ? `<div class="gdr"><span>Website</span><a href="https://${n.website}" target="_blank" rel="noopener">${n.website}</a></div>` : ''}
            </div>
            <div class="graph-detail-connections">
                <span class="gdc-label">Connected to</span>
                ${this._getConnected(n.id).map(c => `
                    <div class="gdc-item" data-id="${c.id}" style="border-left:3px solid ${industryColor(c.group)}">
                        <span class="gdc-name">${c.name}</span>
                        <span class="gdc-type">${c.type}</span>
                    </div>`).join('') || '<span style="color:var(--text-3);font-size:12px">No connections</span>'}
            </div>`
        panel.style.display = 'flex'

        panel.querySelector('#graph-detail-close')?.addEventListener('click', () => {
            this._selectNode(n) // toggle off
        })
        panel.querySelectorAll('.gdc-item[data-id]').forEach(el => {
            el.addEventListener('click', () => {
                const target = this.nodes.find(x => x.id === Number(el.dataset.id))
                if (target) this._selectNode(target)
            })
        })
    }

    _hideDetail() {
        const panel = document.getElementById('graph-detail')
        if (panel) panel.style.display = 'none'
    }

    _getConnected(id) {
        const connected = []
        for (const e of this.edges) {
            if (e.source === id && this.nodeMap[e.target]) {
                connected.push({ ...this.nodeMap[e.target], type: e.type === 'same_industry' ? 'same sector' : 'same city' })
            } else if (e.target === id && this.nodeMap[e.source]) {
                connected.push({ ...this.nodeMap[e.source], type: e.type === 'same_industry' ? 'same sector' : 'same city' })
            }
        }
        return connected.slice(0, 8)
    }

    // ── Highlight ────────────────────────────────────────────────

    _applyHighlight() {
        const hasTerm = !!this._searchTerm
        for (const n of this.nodes) {
            const g      = this._nodeEls[n.id]
            const circle = g?.querySelector('.node-circle')
            const label  = g?.querySelector('.node-label')
            if (!g) continue
            if (hasTerm && n.dimmed) {
                g.setAttribute('opacity', '0.15')
                circle?.removeAttribute('filter')
            } else if (hasTerm && n.highlighted) {
                g.setAttribute('opacity', '1')
                circle?.setAttribute('filter', 'url(#glow)')
            } else {
                g.setAttribute('opacity', '1')
                if (this.selected?.id !== n.id) circle?.removeAttribute('filter')
            }
            // Show/hide labels based on search
            if (label) label.style.display = hasTerm && n.dimmed ? 'none' : ''
        }
        for (const e of this.edges) {
            const el = this._edgeEls[`${e.source}-${e.target}`]
            if (!el) continue
            const aDimmed = this.nodeMap[e.source]?.dimmed
            const bDimmed = this.nodeMap[e.target]?.dimmed
            el.setAttribute('opacity', hasTerm && (aDimmed || bDimmed) ? '0.05' : e.type === 'same_industry' ? '0.5' : '0.2')
        }
    }

    // ── Physics ──────────────────────────────────────────────────

    _tick() {
        const W = this._w(), H = this._h()
        const charge = 2800, spring = 0.035, restLen = 90, damp = 0.8

        // Repulsion (O(n²) but fast enough for ≤80 nodes)
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const a = this.nodes[i], b = this.nodes[j]
                const dx = b.x - a.x, dy = b.y - a.y
                const d2 = dx * dx + dy * dy
                const dist = Math.max(Math.sqrt(d2), 1)
                const f  = charge / d2
                const fx = (dx / dist) * f, fy = (dy / dist) * f
                a.vx -= fx; a.vy -= fy
                b.vx += fx; b.vy += fy
            }
        }

        // Spring + industry clustering
        for (const e of this.edges) {
            const a = this.nodeMap[e.source], b = this.nodeMap[e.target]
            if (!a || !b) continue
            const dx   = b.x - a.x, dy = b.y - a.y
            const dist = Math.max(Math.hypot(dx, dy), 1)
            // Shorter rest length for same-industry (tighter clusters)
            const len = e.type === 'same_industry' ? restLen * 0.65 : restLen * 1.3
            const f   = spring * (dist - len) * (e.weight || 1)
            const fx  = (dx / dist) * f, fy = (dy / dist) * f
            a.vx += fx; a.vy += fy
            b.vx -= fx; b.vy -= fy
        }

        // Gravity + bounds
        for (const n of this.nodes) {
            if (this.dragging === n) continue
            n.vx += (W / 2 - n.x) * 0.0006
            n.vy += (H / 2 - n.y) * 0.0006
            n.vx *= damp; n.vy *= damp
            n.x = Math.max(40, Math.min(W - 40, n.x + n.vx))
            n.y = Math.max(40, Math.min(H - 40, n.y + n.vy))
        }
    }

    // ── Render ───────────────────────────────────────────────────

    _render() {
        const root = this.svg.querySelector('#graph-root')
        if (root) root.setAttribute('transform',
            `translate(${this.transform.x},${this.transform.y}) scale(${this.transform.scale})`)

        // Scale label visibility with zoom
        const showLabels = this.transform.scale > 0.55
        const smallLabels = this.transform.scale < 0.85

        for (const n of this.nodes) {
            const el = this._nodeEls[n.id]
            if (el) {
                el.setAttribute('transform', `translate(${n.x},${n.y})`)
                const lbl = el.querySelector('.node-label')
                if (lbl) {
                    lbl.style.visibility = showLabels ? 'visible' : 'hidden'
                    lbl.setAttribute('font-size', smallLabels ? '8' : '10')
                    lbl.setAttribute('fill', 'rgba(238,240,255,0.65)')
                }
                const circle = el.querySelector('.node-circle')
                if (circle) {
                    circle.setAttribute('stroke', this.selected?.id === n.id ? '#fff' : 'rgba(255,255,255,0.25)')
                    circle.setAttribute('stroke-width', this.selected?.id === n.id ? '2.5' : '1.5')
                }
            }
        }

        for (const e of this.edges) {
            const el = this._edgeEls[`${e.source}-${e.target}`]
            if (!el) continue
            const a = this.nodeMap[e.source], b = this.nodeMap[e.target]
            if (a && b) {
                const col = e.type === 'same_industry' ? 'rgba(99,102,241,0.55)' : 'rgba(148,163,184,0.2)'
                const sw  = e.type === 'same_industry' ? 1.2 : 0.7
                el.setAttribute('x1', a.x); el.setAttribute('y1', a.y)
                el.setAttribute('x2', b.x); el.setAttribute('y2', b.y)
                el.setAttribute('stroke', col)
                el.setAttribute('stroke-width', sw)
            }
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
            const ke = this.nodes.reduce((s, n) => s + n.vx * n.vx + n.vy * n.vy, 0)
            if (iter < 400 || ke > 0.3) {
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

    // ── Interaction ──────────────────────────────────────────────

    _setupInteraction() {
        const svg = this.svg

        // Mousemove: drag node or pan
        svg.addEventListener('mousemove', ev => {
            if (this.dragging) {
                const rect = svg.getBoundingClientRect()
                const s    = this.transform.scale
                this.dragging.x = (ev.clientX - rect.left - this.transform.x) / s
                this.dragging.y = (ev.clientY - rect.top  - this.transform.y) / s
                this.dragging.vx = 0; this.dragging.vy = 0
                if (!this.running) this._render()
            } else if (this.panning) {
                this.transform.x += ev.clientX - this.panning.x
                this.transform.y += ev.clientY - this.panning.y
                this.panning = { x: ev.clientX, y: ev.clientY }
                if (!this.running) this._render()
            }
        })

        svg.addEventListener('mousedown', ev => {
            // Pan on background click
            if (ev.target === svg || ev.target.closest('#graph-root') && !ev.target.closest('.graph-node')) {
                this.panning = { x: ev.clientX, y: ev.clientY }
                // Deselect on background click
                if (ev.target === svg || ev.target.id === 'graph-root') {
                    if (this.selected) this._selectNode(this.selected) // toggle off
                }
            }
        })

        svg.addEventListener('mouseup',    () => { this.dragging = null; this.panning = null })
        svg.addEventListener('mouseleave', () => { this.dragging = null; this.panning = null })

        // Scroll to zoom (centered on cursor)
        svg.addEventListener('wheel', ev => {
            ev.preventDefault()
            const rect   = svg.getBoundingClientRect()
            const mx     = ev.clientX - rect.left
            const my     = ev.clientY - rect.top
            const factor = ev.deltaY > 0 ? 0.88 : 1.13
            const newScale = Math.max(0.15, Math.min(5, this.transform.scale * factor))
            const scaleChange = newScale / this.transform.scale
            this.transform.x = mx - (mx - this.transform.x) * scaleChange
            this.transform.y = my - (my - this.transform.y) * scaleChange
            this.transform.scale = newScale
            if (!this.running) this._render()
        }, { passive: false })

        // Touch support (pinch-to-zoom + drag)
        let lastTouches = []
        svg.addEventListener('touchstart', ev => {
            ev.preventDefault()
            lastTouches = [...ev.touches]
            if (ev.touches.length === 1) {
                const rect = svg.getBoundingClientRect()
                const tx = ev.touches[0].clientX - rect.left
                const ty = ev.touches[0].clientY - rect.top
                // Check if touching a node
                const s = this.transform.scale
                const wx = (tx - this.transform.x) / s
                const wy = (ty - this.transform.y) / s
                const hit = this.nodes.find(n => Math.hypot(n.x - wx, n.y - wy) < (n.size + 8))
                if (hit) this.dragging = hit
                else this.panning = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
            }
        }, { passive: false })

        svg.addEventListener('touchmove', ev => {
            ev.preventDefault()
            if (ev.touches.length === 2 && lastTouches.length === 2) {
                const d1 = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY)
                const d2 = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY)
                if (d1 > 0) this.zoomBy(d2 / d1)
                lastTouches = [...ev.touches]
            } else if (ev.touches.length === 1) {
                const t = ev.touches[0]
                if (this.dragging) {
                    const rect = svg.getBoundingClientRect()
                    const s = this.transform.scale
                    this.dragging.x = (t.clientX - rect.left - this.transform.x) / s
                    this.dragging.y = (t.clientY - rect.top  - this.transform.y) / s
                    this.dragging.vx = 0; this.dragging.vy = 0
                    if (!this.running) this._render()
                } else if (this.panning) {
                    this.transform.x += t.clientX - this.panning.x
                    this.transform.y += t.clientY - this.panning.y
                    this.panning = { x: t.clientX, y: t.clientY }
                    if (!this.running) this._render()
                }
                lastTouches = [...ev.touches]
            }
        }, { passive: false })

        svg.addEventListener('touchend', () => {
            this.dragging = null; this.panning = null; lastTouches = []
        })
    }

    _w() { return this.svg.clientWidth  || 900 }
    _h() { return this.svg.clientHeight || 600 }
}
