/**
 * Small library to replace basic functionality of jQuery
 * methods that start with "_" are internal
 */

 class Query {

    constructor(selector) {
        this.version = 0.1
        /**
         * No need to implementd (selector, context) as it can be archived by
         * $(context).find(selector)
         */
        let nodes = []
        if (Array.isArray(selector)) {
            nodes  = selector
        } else if (selector instanceof DocumentFragment || selector instanceof HTMLElement || selector instanceof Text) {
            if (selector.isConnected) {
                nodes = [selector]
            } else {
                nodes = []
            }
        } else if (selector instanceof Query) {
            nodes = selector.nodes
        } else if (typeof selector == 'string') {
            nodes = Array.from(document.querySelectorAll(selector))
        } else {
            throw new Error('Unknown selector')
        }
        this._refs(nodes)
    }

    _refs(nodes) {
        this.nodes = nodes
        this.length = nodes.length
        // map nodes to object propoerties
        this.each((node, ind) => {
            this[ind] = node
        })
        // delete extra ones
        let ind = this.nodes.length
        while (this[ind]) {
            delete this[ind]
            ind++
        }
    }

    _insert(method, html) {
        let nodes = []
        if (typeof html == 'string') {
            let doc = this[0].ownerDocument
            let template = doc.createElement('template')
            this.each(node => {
                template.innerHTML = html
                if (method == 'replaceWith') {
                    // replace nodes, but keep reference to them
                    nodes.push(...template.content.childNodes)
                }
                node[method](template.content) // inserts nodes or text
            })
            if (method == 'replaceWith') {
                this._refs(nodes)
            }
        } else {
            throw new Error(`Incorrect argument for "${method}(html)". It expects one string argument.`)
        }
        return this
    }

    eq(index) {
        let nodes = [this[index]]
        if (nodes[0] == null) nodes = []
        this._refs(nodes)
        return this
    }

    get(index) {
        let node = this[index]
        if (node) {
            return node
        }
        return this.nodes
    }

    find(selector) {
        let nodes = []
        this.each(node => {
            let nn = Array.from(node.querySelectorAll(selector))
            if (nn.length > 0) {
                nodes.push(...nn)
            }
        })
        this._refs(nodes)
        return this
    }

    shadow(selector) {
        let nodes = []
        this.each(node => {
            // select shadow root if available
            if (node.shadowRoot) nodes.push(node.shadowRoot)
        })
        this._refs(nodes)
        if (selector) {
            return this.find(selector)
        }
        return this
    }

    closest(selector) {
        let nodes = []
        this.each(node => {
            let nn = node.closest(selector)
            if (nn) {
                nodes.push(nn)
            }
        })
        this._refs(nodes)
        return this
    }

    // host()
    // host(all)
    host(all) {
        let nodes = []
        // find shadow root or body
        let top = (node) => {
            if (node.parentNode) {
                return top(node.parentNode)
            } else {
                return node
            }
        }
        this.each(node => {
            let fun = (node) => {
                let nn = top(node)
                nodes.push(nn.host ? nn.host : nn)
                if (nn.host && all) fun(nn.host)
            }
            fun(node)
        })
        this._refs(nodes)
        return this
    }

    each(func) {
        this.nodes.forEach((node, ind) => { func(node, ind, this) })
        return this
    }

    append(html) {
        return this._insert('append', html)
    }

    prepend(html) {
        return this._insert('prepend', html)
    }

    after(html) {
        return this._insert('after', html)
    }

    before(html) {
        // updates this.nodes with replaced items
        return this._insert('before', html)
    }

    replace(html) {
        return this._insert('replaceWith', html)
    }

    remove() {
        // remove from dom, but keep in current query
        this.each(node => { node.remove() })
        return this
    }

    empty() {
        return this.html('')
    }

    html(html) {
        return this.prop('innerHTML', html)
    }

    text(text) {
        return this.prop('textContent', text)
    }

    val(value) {
        return this.attr('value', value)
    }

    css(key, value) {
        let css = key
        let len = arguments.length
        if (len === 0 || (len ===1 && typeof key == 'string')) {
            if (this[0]) {
                // do not do computedStyleMap as it is not what on immediate element
                if (typeof key == 'string') {
                    return this[0].style[key]
                } else {
                    return Object.fromEntries(
                        this[0].style.cssText
                            .split(';')
                            .filter(a => !!a) // filter non-empty
                            .map(a => {
                                return a.split(':').map(a => a.trim()) // trim strings
                            })
                        )
                }
            } else {
                return undefined
            }
        } else {
            if (typeof key != 'object') {
                css = {}
                css[key] = value
            }
            this.each((el, ind) => {
                Object.keys(css).forEach(key => {
                    el.style[key] = css[key]
                })
            })
            return this
        }
    }

    addClass(classes) {
        this.toggleClass(classes, true)
        return this
    }

    removeClass(classes) {
        this.toggleClass(classes, false)
        return this
    }

    toggleClass(classes, force) {
        // split by comma or space
        if (typeof classes == 'string') classes = classes.split(/[ ,]+/)
        this.each(node => {
            let classes2 = classes
            // if not defined, remove all classes
            if (classes2 == null && force === false) classes2 = Array.from(node.classList)
            classes2.forEach(className => {
                if (className !== '') {
                    let act = 'toggle'
                    if (force != null) act = force ? 'add' : 'remove'
                    node.classList[act](className)
                }
            })
        })
        return this
    }

    hasClass(classes) {
        // split by comma or space
        if (typeof classes == 'string') classes = classes.split(/[ ,]+/)
        let ret = true
        if (classes == null && this.length > 0) {
            return Array.from(this[0].classList)
        }
        this.each(node => {
            let current = Array.from(node.classList)
            classes.forEach(className => {
                if (!current.includes(className) && ret === true) {
                    ret = false
                }
            })
        })
        return ret
    }

    on(eventScope, options, callback) {
        let [ event, scope ] = String(eventScope).toLowerCase().split('.')
        if (typeof options == 'function') {
            callback = options
            options = undefined
        }
        this.each(node => {
            node._mQuery = node._mQuery ?? {}
            node._mQuery.events = node._mQuery.events ?? []
            node._mQuery.events.push({ event, scope, callback, options })
            node.addEventListener(event, callback, options)
        })
        return this
    }

    off(eventScope, options, callback) {
        let [ event, scope ] = String(eventScope).toLowerCase().split('.')
        if (typeof options == 'function') {
            callback = options
            options = undefined
        }
        this.each(node => {
            if (node._mQuery && Array.isArray(node._mQuery.events)) {
                for (let i = node._mQuery.events.length - 1; i >= 0; i--) {
                    let evt = node._mQuery.events[i]
                    if (scope == null || scope === '') {
                        // if no scope, has to be exact match
                        if (evt.event == event && evt.scope == scope && evt.callback == callback) {
                            node.removeEventListener(event, callback, options)
                            node._mQuery.events.splice(i, 1)
                        }
                    } else {
                        if ((evt.event == event || event === '') && (evt.scope == scope || scope === '*')) {
                            node.removeEventListener(evt.event, evt.callback, evt.options)
                            node._mQuery.events.splice(i, 1)
                        }
                    }
                }
            }
        })
        return this
    }

    trigger(name, options) {
        // TODO: Implement
        return this
    }

    attr(name, value) {
        if (value === undefined && typeof name == 'string') {
            return this[0] ? this[0].getAttribute(name) : undefined
        } else {
            let obj = {}
            if (typeof name == 'object') obj = name; else obj[name] = value
            this.each(node => {
                Object.entries(obj).forEach(([nm, val]) => { node.setAttribute(nm, val) })
            })
            return this
        }
    }

    removeAttr() {
        this.each(node => {
            Array.from(arguments).forEach(attr => {
                node.removeAttribute(attr)
            })
        })
        return this
    }

    prop(name, value) {
        if (value === undefined && typeof name == 'string') {
            return this[0] ? this[0][name] : undefined
        } else {
            let obj = {}
            if (typeof name == 'object') obj = name; else obj[name] = value
            this.each(node => {
                Object.entries(obj).forEach(([nm, val]) => { node[nm] = val })
            })
            return this
        }
    }

    removeProp() {
        this.each(node => {
            Array.from(arguments).forEach(prop => { delete node[prop] })
        })
        return this
    }

    data(key, value) {
        if (arguments.length < 2) {
            if (this[0]) {
                let data = this[0]._mQuery?.data ?? {}
                // also pick all atributes that start with data-*
                Array.from(this[0].attributes).forEach(attr => {
                    if (attr.name.substr(0, 5) == 'data-') {
                        let val = attr.value
                        let nm  = attr.name.substr(5)
                        // if it is JSON - parse it
                        if (['[', '{'].includes(String(val).substr(0, 1))) {
                            try { val = JSON.parse(val) } catch(e) { val = attr.value }
                        }
                        // attributes have lower priority than set with data()
                        if (data[nm] === undefined) data[nm] = val
                    }
                })
                return key ? data[key] : data
            } else {
                return undefined
            }
        } else {
            this.each(node => {
                node._mQuery = node._mQuery ?? {}
                node._mQuery.data = node._mQuery.data ?? {}
                if (value != null) {
                    node._mQuery.data[key] = value
                } else {
                    delete node._mQuery.data[key]
                }
            })
            return this
        }
    }

    removeData(key) {
        this.each(node => {
            node._mQuery = node._mQuery ?? {}
            if (arguments.lenth == 0) {
                node._mQuery.data = {}
            } else if (key != null && node._mQuery.data) {
                delete node._mQuery.data[key]
            } else {
                node._mQuery.data = {}
            }
        })
        return this
    }

    show() {
        return this.css('display', '')
    }

    hide() {
        return this.css('display', 'none')
    }

    toggle() {
        let dsp = this.css('display')
        return this.css('display', dsp == 'none' ? '' : 'none')
    }
}
// create a new object each time
let query = function (selector, context) {
    return new Query(selector, context)
}
let $ = query

export default $
export { $, query, Query }