
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * LearningQueue - Adaptive Spaced Repetition System
     * 
     * A sophisticated queue-based language learning system that uses AI-scored responses
     * and inertia-based movement to optimize vocabulary retention.
     */

    class LearningQueue {
      constructor(sourceLanguage, targetLanguage, level = 'basic', baseDir = '/learning/', options = {}, logFunction = null) {
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.baseDir = baseDir;
        this.level = level;
        this.testDatabase = {};
        this.queue = [];
        this.categories = {};
        this.currentTestIndex = 0;
        this.storageKey = `learning_queue_${sourceLanguage}_${targetLanguage}_${level}`;
        this.log = logFunction || ((level, ...args) => {}); // Default to no-op if no logger provided
        
        // Initialize options with defaults
        this.options = {
          passThreshold: 7,
          memoryLength: 20,
          repetitivenessFactor: 5,
          ...options
        };
        
        // Don't call init() automatically - let the caller control when it happens
      }
      
      async init() {
        await this.loadTestData();
        this.loadState();
      }
      
      async loadTestData() {
        try {
          const filename = `${this.sourceLanguage}-${this.targetLanguage}-${this.level}.json`;
          const response = await fetch(`${this.baseDir}${filename}`);
          
          if (!response.ok) {
            throw new Error(`Failed to load test data: ${response.status}`);
          }
          
          this.testDatabase = await response.json();
        } catch (error) {
          console.error('Error loading test data:', error);
          // Fallback to sample data for demo
          this.testDatabase = {
            "travel": [
              { source: "Good morning", target: "Buongiorno" },
              { source: "Where is the station?", target: "Dove è la stazione?" },
              { source: "Thank you very much", target: "Grazie mille" }
            ],
            "food": [
              { source: "I would like a coffee", target: "Vorrei un caffè" },
              { source: "How much does it cost?", target: "Quanto costa?" },
              { source: "The bill please", target: "Il conto per favore" }
            ]
          };
        }
      }
      
      loadState() {
        const savedState = localStorage.getItem(this.storageKey);
        
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            this.categories = state.categories || {};
            this.queue = state.queue || [];
            
            this.syncQueueWithDatabase();
          } catch (error) {
            console.error('Error loading saved state:', error);
            this.initializeAllCategories();
          }
        } else {
          this.initializeAllCategories();
        }
      }
      
      syncQueueWithDatabase() {
        const expectedTests = new Set();
        
        for (const [categoryName, isSelected] of Object.entries(this.categories)) {
          if (isSelected && this.testDatabase[categoryName]) {
            this.testDatabase[categoryName].forEach(test => {
              expectedTests.add(this.createTestId(test));
            });
          }
        }
        
        // Filter out tests that are no longer in selected categories
        this.queue = this.queue.filter(item => {
          const testId = this.createTestId({ source: item.source, target: item.target });
          return expectedTests.has(testId);
        });
        
        // Update existing queue items with new data from JSON (like pronunciation)
        this.queue = this.queue.map(item => {
          const testId = this.createTestId({ source: item.source, target: item.target });
          
          // Find the corresponding test in the database
          for (const [categoryName, isSelected] of Object.entries(this.categories)) {
            if (isSelected && this.testDatabase[categoryName]) {
              const matchingTest = this.testDatabase[categoryName].find(test => 
                this.createTestId(test) === testId
              );
              
              if (matchingTest) {
                // Debug: Log pronunciation data
                this.log(8, '🔍 Syncing queue item:', {
                  testId,
                  oldItem: { source: item.source, target: item.target, pronunciation: item.pronunciation },
                  newData: { source: matchingTest.source, target: matchingTest.target, pronunciation: matchingTest.pronunciation }
                });
                
                // Merge new fields from JSON while preserving learning progress
                return {
                  ...item, // Keep existing progress data (inertia, recentResults, etc.)
                  source: matchingTest.source,
                  target: matchingTest.target,
                  pronunciation: matchingTest.pronunciation, // Update with new pronunciation data
                  category: categoryName
                };
              }
            }
          }
          
          return item; // Return unchanged if not found (shouldn't happen due to filter above)
        });
        
        const currentTestIds = new Set(this.queue.map(item => 
          this.createTestId({ source: item.source, target: item.target })
        ));
        
        // Add new tests that aren't in the queue yet
        for (const [categoryName, isSelected] of Object.entries(this.categories)) {
          if (isSelected && this.testDatabase[categoryName]) {
            this.testDatabase[categoryName].forEach(test => {
              const testId = this.createTestId(test);
              if (!currentTestIds.has(testId)) {
                this.addTestToQueue(test, categoryName);
              }
            });
          }
        }
      }
      
      initializeAllCategories() {
        // Don't automatically enable all categories - let the UI control this
        for (const categoryName of Object.keys(this.testDatabase)) {
          this.categories[categoryName] = false; // Start with all disabled
        }
      }
      
      createTestId(test) {
        return `${test.source}|${test.target}`;
      }
      
      addTestToQueue(test, categoryName) {
        const queueItem = {
          source: test.source,
          target: test.target,
          pronunciation: test.pronunciation, // Include pronunciation guide if available
          inertia: -1, // Start at maximum resistance - phrases are "sticky" until learned
          category: categoryName,
          recentResults: new Array(this.options.memoryLength).fill(0) // Initialize with full history of failures
        };
        
        const randomIndex = Math.floor(Math.random() * (this.queue.length + 1));
        this.queue.splice(randomIndex, 0, queueItem);
      }
      
      addCategoryToQueue(categoryName) {
        if (this.testDatabase[categoryName]) {
          this.testDatabase[categoryName].forEach(test => {
            this.addTestToQueue(test, categoryName);
          });
        }
      }
      
      removeCategoryFromQueue(categoryName) {
        if (!this.testDatabase[categoryName]) return;
        
        const categoryTestIds = new Set(
          this.testDatabase[categoryName].map(test => this.createTestId(test))
        );
        
        this.queue = this.queue.filter(item => {
          const testId = this.createTestId({ source: item.source, target: item.target });
          return !categoryTestIds.has(testId);
        });
        
        if (this.currentTestIndex >= this.queue.length) {
          this.currentTestIndex = 0;
        }
      }
      
      getCategories() {
        return Object.keys(this.testDatabase);
      }
      
      setCategory(categoryName, enabled) {
        if (enabled && !this.categories[categoryName]) {
          this.categories[categoryName] = true;
          this.addCategoryToQueue(categoryName);
        } else if (!enabled && this.categories[categoryName]) {
          this.categories[categoryName] = false;
          this.removeCategoryFromQueue(categoryName);
        }
        
        this.saveState();
      }
      
      getNextTest() {
        if (this.queue.length === 0) {
          return null;
        }
        
        if (this.currentTestIndex >= this.queue.length) {
          this.currentTestIndex = 0;
        }
        
        const test = this.queue[this.currentTestIndex];
        
        // Debug: Log what's being returned
        this.log(8, '📤 getNextTest returning:', {
          source: test.source,
          target: test.target,
          pronunciation: test.pronunciation,
          hasPronunciation: !!test.pronunciation,
          fullTest: test
        });
        
        return {
          source: test.source,
          target: test.target,
          pronunciation: test.pronunciation, // Include pronunciation guide
          inertia: test.inertia,
          category: test.category,
          recentResults: test.recentResults || [] // Include history in response
        };
      }
      
      scoreCurrentTest(score) {
        if (this.queue.length === 0 || this.currentTestIndex >= this.queue.length) {
          return;
        }
        
        const currentTest = this.queue.splice(this.currentTestIndex, 1)[0];
        
        // Update binary algorithm with memory
        if (!currentTest.recentResults) {
          currentTest.recentResults = [];
        }
        
        // Add new result (1 for pass, 0 for fail)
        const passed = score >= this.options.passThreshold;
        currentTest.recentResults.push(passed ? 1 : 0);
        
        // If the test failed, convert the most recent success to a failure
        if (!passed) {
          // Find the most recent success (working backwards from the end)
          for (let i = currentTest.recentResults.length - 2; i >= 0; i--) {
            if (currentTest.recentResults[i] === 1) {
              currentTest.recentResults[i] = 0;
              break; // Only convert one success
            }
          }
        }
        
        // Keep only last N results
        const memoryLength = this.options.memoryLength;
        if (currentTest.recentResults.length > memoryLength) {
          currentTest.recentResults = currentTest.recentResults.slice(-memoryLength);
        }
        
        // Calculate success rate
        const successCount = currentTest.recentResults.reduce((sum, result) => sum + result, 0);
        const successRate = currentTest.recentResults.length > 0 ? successCount / currentTest.recentResults.length : 0;
        
        // Calculate movement based on success rate and repetitiveness factor
        const repetitivenessFactor = this.options.repetitivenessFactor;
        const power = 2 + (repetitivenessFactor - 1) * 0.2; // Maps 1-10 to 2.0-3.8
        const movement = Math.pow(successRate, power);
        
        // Calculate new position in queue
        const newPosition = Math.min(Math.floor(movement * this.queue.length), this.queue.length);
        
        this.queue.splice(newPosition, 0, currentTest);
        
        this.currentTestIndex = 0;
        
        this.saveState();
      }
      
      updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
      }
      
      saveState() {
        const state = {
          categories: this.categories,
          queue: this.queue
        };
        
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (error) {
          console.error('Error saving state to localStorage:', error);
        }
      }
      
      getQueueLength() {
        return this.queue.length;
      }
      
      getTopQueueItems(count = null) {
        const itemsToShow = count ? Math.min(count, this.queue.length) : this.queue.length;
        return this.queue.slice(0, itemsToShow).map((item, index) => {
          const successCount = item.recentResults ? item.recentResults.reduce((sum, result) => sum + result, 0) : 0;
          const successRate = item.recentResults && item.recentResults.length > 0 ? successCount / item.recentResults.length : 0;
          
          return {
            position: index + 1,
            source: item.source,
            target: item.target,
            inertia: item.inertia,
            category: item.category,
            recentResults: item.recentResults || [],
            successRate: successRate
          };
        });
      }
      
      reset() {
        this.log(5, '🔄 Resetting LearningQueue to initial state');
        this.queue = [];
        this.categories = {};
        this.currentTestIndex = 0;
        localStorage.removeItem(this.storageKey);
        this.initializeAllCategories();
        this.log(5, '✅ LearningQueue reset complete');
      }
      
      getQueueStats() {
        const stats = {
          totalItems: this.queue.length,
          categories: {},
          inertiaDistribution: {
            negative: 0,
            neutral: 0,
            positive: 0
          }
        };
        
        // Count items by category and success rate
        this.queue.forEach(item => {
          // Category stats
          if (!stats.categories[item.category]) {
            stats.categories[item.category] = 0;
          }
          stats.categories[item.category]++;
          
          // Success rate distribution (using recentResults for binary algorithm)
          const successCount = item.recentResults ? item.recentResults.reduce((sum, result) => sum + result, 0) : 0;
          const successRate = item.recentResults && item.recentResults.length > 0 ? successCount / item.recentResults.length : 0;
          
          if (successRate < 0.3) {
            stats.inertiaDistribution.negative++;
          } else if (successRate > 0.7) {
            stats.inertiaDistribution.positive++;
          } else {
            stats.inertiaDistribution.neutral++;
          }
        });
        
        return stats;
      }
    }

    /**
     * PronunciationScorer - A class for scoring pronunciation accuracy
     * 
     * This class compares a reference pronunciation with user input and provides
     * scores for syllable accuracy and emphasis accuracy.
     * 
     * Usage:
     *   import { PronunciationScorer } from './pronunciationScorer.js';
     *   const scorer = new PronunciationScorer();
     *   const result = scorer.score(reference, userInput);
     *   console.log(`Score: ${result.finalScore}/10`);
     * 
     * Dependencies:
     *   - Requires either fast-levenshtein library (preferred) or uses built-in fallback
     *   - If using fast-levenshtein, ensure it's loaded before this class
     */
    class PronunciationScorer {
        /**
         * Constructor
         * @param {Object} options - Configuration options
         * @param {number} options.syllableWeight - Weight for syllable accuracy (0-1, default: 0.7)
         * @param {number} options.emphasisWeight - Weight for emphasis accuracy (0-1, default: 0.3)
         * @param {boolean} options.autoNormalizeWeights - Auto-normalize weights to sum to 1 (default: true)
         */
        constructor(options = {}) {
            this.syllableWeight = options.syllableWeight || 0.8;
            this.emphasisWeight = options.emphasisWeight || 0.2;
            this.autoNormalizeWeights = options.autoNormalizeWeights !== false;
            
            // Normalize weights if requested
            if (this.autoNormalizeWeights) {
                this._normalizeWeights();
            }
            
            // Initialize Levenshtein function
            this._initializeLevenshtein();
        }
        
        /**
         * Set scoring weights
         * @param {number} syllableWeight - Weight for syllable accuracy (0-1)
         * @param {number} emphasisWeight - Weight for emphasis accuracy (0-1)
         */
        setWeights(syllableWeight, emphasisWeight) {
            this.syllableWeight = syllableWeight;
            this.emphasisWeight = emphasisWeight;
            
            if (this.autoNormalizeWeights) {
                this._normalizeWeights();
            }
        }
        
        /**
         * Score pronunciation accuracy
         * @param {string} reference - Reference pronunciation with emphasis (case-sensitive)
         * @param {string} userInput - User's pronunciation attempt
         * @returns {Object} Scoring results
         */
        score(reference, userInput) {
            // Validate inputs
            if (typeof reference !== 'string' || typeof userInput !== 'string') {
                throw new Error('Both reference and userInput must be strings');
            }
            
            // Normalize both strings: replace non-alpha with spaces, collapse multiple spaces
            const normalizedReference = this._normalizeString(reference);
            const normalizedUserInput = this._normalizeString(userInput);
            
            if (normalizedReference.length === 0 || normalizedUserInput.length === 0) {
                return this._createResult(0, {
                    syllableDistance: Math.max(normalizedReference.length, normalizedUserInput.length),
                    emphasisDistance: Math.max(normalizedReference.length, normalizedUserInput.length),
                    emphasisDifference: 0,
                    syllableScore: 1,
                    emphasisScore: 0
                }, reference, userInput);
            }
            
            // Calculate both distances using normalized strings
            const syllableDistance = this._levenshtein(normalizedReference.toLowerCase(), normalizedUserInput.toLowerCase());
            const emphasisDistance = this._levenshtein(normalizedReference, normalizedUserInput);
            
            // Calculate maximum possible distances for normalization
            const totalLength = normalizedReference.length + normalizedUserInput.length;
            const maxSyllableDistance = totalLength;
            const maxEmphasisDifference = Math.min(normalizedReference.length, normalizedUserInput.length);
            
            // Calculate normalized scores (0 = perfect, 1 = worst possible)
            const syllableScore = maxSyllableDistance > 0 ? syllableDistance / maxSyllableDistance : 0;
            
            // Emphasis score is based on the difference between the two distances
            const emphasisDifference = Math.abs(emphasisDistance - syllableDistance);
            const emphasisScore = maxEmphasisDifference > 0 ? emphasisDifference / maxEmphasisDifference : 0;
            
            // Combine scores with weighting
            const combinedScore = (syllableScore * this.syllableWeight) + (emphasisScore * this.emphasisWeight);
            
            // Convert to 0-10 scale (10 = perfect, 0 = terrible)
            // Square the distance because the scores felt a bit top-heavy (it was giving heigh scores too often)
            let finalScore = Math.max(0, 10 * ( (1 - combinedScore) ** 2));
            
            // Length-based leniency: shorter phrases get a score boost
            const referenceLength = normalizedReference.length;
            if (referenceLength <= 8) {
                // Apply progressively more generous scoring for very short phrases
                const lengthBonus = Math.max(0, (8 - referenceLength) * 0.5); // Up to 4 point bonus for very short phrases
                finalScore = Math.min(10, finalScore + lengthBonus);
            }
            
            return this._createResult(finalScore, {
                syllableDistance,
                emphasisDistance,
                emphasisDifference,
                syllableScore,
                emphasisScore
            }, reference, userInput);
        }
        
        /**
         * Batch score multiple pronunciation attempts
         * @param {string} reference - Reference pronunciation
         * @param {string[]} userInputs - Array of user pronunciation attempts
         * @returns {Object[]} Array of scoring results
         */
        batchScore(reference, userInputs) {
            if (!Array.isArray(userInputs)) {
                throw new Error('userInputs must be an array');
            }
            
            return userInputs.map(input => this.score(reference, input));
        }
        
        /**
         * Get the current configuration
         * @returns {Object} Current configuration
         */
        getConfig() {
            return {
                syllableWeight: this.syllableWeight,
                emphasisWeight: this.emphasisWeight,
                autoNormalizeWeights: this.autoNormalizeWeights,
                levenshteinSource: this._levenshteinSource
            };
        }
        
        /**
         * Create a detailed result object
         * @private
         */
        _createResult(finalScore, details, originalReference = '', originalUserInput = '') {
            return {
                finalScore: Math.round(finalScore * 10) / 10,
                grade: this._getGrade(finalScore),
                originalReference: originalReference,
                originalUserInput: originalUserInput,
                details: {
                    syllableDistance: details.syllableDistance,
                    emphasisDistance: details.emphasisDistance,
                    emphasisDifference: details.emphasisDifference,
                    syllableScore: Math.round(details.syllableScore * 1000) / 1000,
                    emphasisScore: Math.round(details.emphasisScore * 1000) / 1000,
                    syllableScoreOut10: Math.round(10 * (1 - details.syllableScore) * 10) / 10,
                    emphasisScoreOut10: Math.round(10 * (1 - details.emphasisScore) * 10) / 10
                },
                weights: {
                    syllable: this.syllableWeight,
                    emphasis: this.emphasisWeight
                }
            };
        }
        
        /**
         * Get letter grade based on score
         * @private
         */
        _getGrade(score) {
            if (score >= 9) return 'A+';
            if (score >= 8) return 'A';
            if (score >= 7) return 'B';
            if (score >= 6) return 'C';
            if (score >= 5) return 'D';
            return 'F';
        }
        
        /**
         * Normalize weights to sum to 1
         * @private
         */
        _normalizeWeights() {
            const total = this.syllableWeight + this.emphasisWeight;
            if (total > 0) {
                this.syllableWeight = this.syllableWeight / total;
                this.emphasisWeight = this.emphasisWeight / total;
            }
        }
        
        /**
         * Normalize input string by replacing non-alpha characters with spaces
         * and collapsing multiple spaces into single spaces
         * @private
         */
        _normalizeString(text) {
            return text
                .replace(/[^a-zA-Z]/g, ' ')  // Replace non-alphabetic characters with spaces
                .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
                .trim();                     // Remove leading/trailing whitespace
        }
        
        /**
         * Initialize Levenshtein distance function
         * @private
         */
        _initializeLevenshtein() {
            // Try to use fast-levenshtein if available
            if (typeof levenshtein !== 'undefined' && levenshtein.get) {
                this._levenshtein = levenshtein.get;
                this._levenshteinSource = 'fast-levenshtein';
            }
            // Try alternative global names
            else if (typeof fastLevenshtein !== 'undefined' && fastLevenshtein.get) {
                this._levenshtein = fastLevenshtein.get;
                this._levenshteinSource = 'fast-levenshtein (fastLevenshtein)';
            }
            // Try window.Levenshtein (from levenshtein.min.js)
            else if (typeof window !== 'undefined' && typeof window.Levenshtein !== 'undefined' && window.Levenshtein.get) {
                this._levenshtein = window.Levenshtein.get;
                this._levenshteinSource = 'fast-levenshtein (window.Levenshtein)';
            }
            // Try global Levenshtein
            else if (typeof Levenshtein !== 'undefined' && Levenshtein.get) {
                this._levenshtein = Levenshtein.get;
                this._levenshteinSource = 'fast-levenshtein (Levenshtein)';
            }
            // Fallback to built-in implementation
            else {
                this._levenshtein = this._builtinLevenshtein;
                this._levenshteinSource = 'built-in';
            }
        }
        
        /**
         * Built-in Levenshtein distance implementation
         * @private
         */
        _builtinLevenshtein(a, b) {
            const matrix = [];
            
            // Initialize first row and column
            for (let i = 0; i <= b.length; i++) {
                matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
                matrix[0][j] = j;
            }
            
            // Fill the matrix
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1, // substitution
                            matrix[i][j - 1] + 1,     // insertion
                            matrix[i - 1][j] + 1      // deletion
                        );
                    }
                }
            }
            
            return matrix[b.length][a.length];
        }
        
        /**
         * Static helper method to create a scorer with common presets
         */
        static createPreset(preset = 'balanced') {
            const presets = {
                'syllable-focused': { syllableWeight: 0.8, emphasisWeight: 0.2 },
                'balanced': { syllableWeight: 0.7, emphasisWeight: 0.3 },
                'emphasis-focused': { syllableWeight: 0.5, emphasisWeight: 0.5 },
                'equal': { syllableWeight: 0.5, emphasisWeight: 0.5 }
            };
            
            if (!presets[preset]) {
                throw new Error(`Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`);
            }
            
            return new PronunciationScorer(presets[preset]);
        }
    }

    // Example usage and tests (can be removed in production)
    // Now using ES6 exports - import with: import { PronunciationScorer } from './pronunciationScorer.js';

    // Example usage:
    /*
    // Basic usage
    const scorer = new PronunciationScorer();
    const result = scorer.score("DOH-veh POS-soh", "DOH-veh pos-soh");
    console.log(`Score: ${result.finalScore}/10 (${result.grade})`);

    // Custom weights
    const customScorer = new PronunciationScorer({
        syllableWeight: 0.8,
        emphasisWeight: 0.2
    });

    // Using presets
    const balancedScorer = PronunciationScorer.createPreset('balanced');
    const emphasisScorer = PronunciationScorer.createPreset('emphasis-focused');

    // Batch scoring
    const attempts = ["DOH-veh pos-soh", "doh-VEH pos-SOH", "DOH-veh POS-soh"];
    const results = scorer.batchScore("DOH-veh POS-soh", attempts);
    */

    /**
     * LanguageTutor - AI-Powered Language Learning with Real-time Pronunciation Scoring
     * 
     * A powerful JavaScript class for building language learning applications with real-time 
     * pronunciation scoring and text-to-speech feedback using OpenAI's Realtime API.
     * Enhanced with audible notification bleeps for user interaction prompts.
     */

    class LanguageTutor {
        constructor(outputElement, sourceLanguage = 'English', targetLanguage = 'Italian', options = {}, logFunction = null) {
            // Basic configuration
            this.outputElement = outputElement;
            this.sourceLanguage = sourceLanguage;
            this.targetLanguage = targetLanguage;
            this.log = logFunction || ((level, ...args) => {}); // Use provided log function or no-op
            
            // Default options
            const defaultOptions = {
                apiKeyEndpoint: '?mode=get_key',
                feedbackThreshold: 7,  // Score below which target pronunciation is played
                passThreshold: 7,      // Score threshold for determining pass/fail (for audio feedback)
                statusCallback: null,  // Optional callback for status updates
                audioPath: 'audio/',   // Base path for pre-generated audio files
                enableBleep: true,     // Enable audible notification bleep (NEW)
                enableAudioHints: false, // Enable audio hints for struggling phrases
                audioHintDuration: 0.25, // Fraction of audio to play as hint (0.25 = 25%)
                audioHintMinWords: 3,    // Minimum words in phrase to enable hints
                vad: {
                    threshold: 0.6,
                    prefixPaddingMs: 200,
                    silenceDurationMs: 800
                }
            };
            
            // Merge user options with defaults
            this.options = this.mergeOptions(defaultOptions, options);
            
            // Audio state
            this.audioContext = null;
            this.currentAudioStream = null;
            this.audioProcessor = null;
            this.ws = null;
            this.isListening = false;
            this.isLearningSessionActive = false; // Track if we're in a learning session
            
            // Session key management
            this.currentSessionKey = null;
            this.keyRefreshInterval = null;
            
            // Initialize pronunciation scorer
            this.pronunciationScorer = new PronunciationScorer();
            
            this.log(3, `🎓 LanguageTutor initialized: ${sourceLanguage} → ${targetLanguage}`);
            this.log(7, '📋 Options:', this.options);
            
            // Start session key management
            this.initializeSessionKeys();
        }
        
        // ========== LOGGING SYSTEM ==========
        
        // Error and warning logging also use the passed-in log function
        
        // ========== UTILITY METHODS ==========
        mergeOptions(defaults, userOptions) {
            const merged = { ...defaults };
            
            for (const key in userOptions) {
                if (userOptions.hasOwnProperty(key)) {
                    if (typeof userOptions[key] === 'object' && userOptions[key] !== null && !Array.isArray(userOptions[key])) {
                        // Deep merge for nested objects like 'vad'
                        merged[key] = { ...defaults[key], ...userOptions[key] };
                    } else {
                        merged[key] = userOptions[key];
                    }
                }
            }
            
            return merged;
        }
        
        // ========== AUDIO NOTIFICATION SYSTEM (NEW) ==========
        /**
         * Generate a pleasant notification bleep to signal user interaction
         */
        async playNotificationBleep() {
            if (!this.options.enableBleep) {
                this.log(7, '🔇 Notification bleep disabled');
                return;
            }
            
            try {
                this.log(6, '🎵 Playing notification bleep');
                
                // Create a temporary audio context for the bleep
                const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create a pleasant two-tone bleep (like a gentle chime)
                const duration = 0.3; // 300ms total
                const sampleRate = tempAudioContext.sampleRate;
                const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
                const data = buffer.getChannelData(0);
                
                // Generate a pleasant two-tone bleep: 800Hz then 1000Hz
                for (let i = 0; i < buffer.length; i++) {
                    const time = i / sampleRate;
                    let frequency;
                    let amplitude;
                    
                    if (time < 0.15) {
                        // First tone: 800Hz
                        frequency = 800;
                        amplitude = 0.1 * Math.sin(Math.PI * time / 0.15); // Fade in/out
                    } else {
                        // Second tone: 1000Hz  
                        frequency = 1000;
                        amplitude = 0.1 * Math.sin(Math.PI * (time - 0.15) / 0.15); // Fade in/out
                    }
                    
                    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
                }
                
                // Play the bleep
                const source = tempAudioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(tempAudioContext.destination);
                
                return new Promise((resolve) => {
                    source.onended = () => {
                        tempAudioContext.close();
                        this.log(7, '✅ Notification bleep completed');
                        resolve();
                    };
                    
                    source.start();
                });
                
            } catch (error) {
                this.log(4, '⚠️ Could not play notification bleep:', error.message);
                // Don't throw - this is a nice-to-have feature
            }
        }
        
        /**
         * Play a success feedback bleep (ascending tones)
         */
        async playSuccessBleep() {
            if (!this.options.enableBleep) {
                this.log(7, '🔇 Success bleep disabled');
                return;
            }
            
            try {
                this.log(6, '🎵 Playing success bleep');
                
                const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const duration = 0.25; // 250ms
                const sampleRate = tempAudioContext.sampleRate;
                const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
                const data = buffer.getChannelData(0);
                
                // Generate ascending success tones: 600Hz -> 800Hz -> 1000Hz
                for (let i = 0; i < buffer.length; i++) {
                    const time = i / sampleRate;
                    let frequency;
                    let amplitude = 0.08; // Slightly quieter than notification
                    
                    if (time < 0.08) {
                        frequency = 600;
                        amplitude *= Math.sin(Math.PI * time / 0.08);
                    } else if (time < 0.16) {
                        frequency = 800;
                        amplitude *= Math.sin(Math.PI * (time - 0.08) / 0.08);
                    } else {
                        frequency = 1000;
                        amplitude *= Math.sin(Math.PI * (time - 0.16) / 0.09);
                    }
                    
                    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
                }
                
                const source = tempAudioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(tempAudioContext.destination);
                
                return new Promise((resolve) => {
                    source.onended = () => {
                        tempAudioContext.close();
                        this.log(7, '✅ Success bleep completed');
                        resolve();
                    };
                    source.start();
                });
                
            } catch (error) {
                this.log(4, '⚠️ Could not play success bleep:', error.message);
            }
        }
        
        /**
         * Play a failure feedback bleep (descending tone)
         */
        async playFailureBleep() {
            if (!this.options.enableBleep) {
                this.log(7, '🔇 Failure bleep disabled');
                return;
            }
            
            try {
                this.log(6, '🎵 Playing failure bleep');
                
                const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                const duration = 0.4; // 400ms - longer for failure
                const sampleRate = tempAudioContext.sampleRate;
                const buffer = tempAudioContext.createBuffer(1, duration * sampleRate, sampleRate);
                const data = buffer.getChannelData(0);
                
                // Generate descending failure tone: 500Hz -> 300Hz
                for (let i = 0; i < buffer.length; i++) {
                    const time = i / sampleRate;
                    const progress = time / duration;
                    const frequency = 500 - (200 * progress); // Descend from 500Hz to 300Hz
                    let amplitude = 0.06 * (1 - progress * 0.3); // Fade out gradually
                    
                    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * time);
                }
                
                const source = tempAudioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(tempAudioContext.destination);
                
                return new Promise((resolve) => {
                    source.onended = () => {
                        tempAudioContext.close();
                        this.log(7, '✅ Failure bleep completed');
                        resolve();
                    };
                    source.start();
                });
                
            } catch (error) {
                this.log(4, '⚠️ Could not play failure bleep:', error.message);
            }
        }
        
        // ========== SESSION KEY MANAGEMENT ==========
        async initializeSessionKeys() {
            try {
                await this.refreshSessionKey();
                this.startKeyRefreshTimer();
            } catch (error) {
                this.log(1, '❌ Failed to initialize session keys:', error);
            }
        }
        
        async refreshSessionKey() {
            try {
                this.log(5, '🔑 Refreshing session key...');
                const response = await fetch(this.options.apiKeyEndpoint);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                this.currentSessionKey = data.session_token;
                this.log(4, '✅ Session key refreshed successfully');
                return this.currentSessionKey;
            } catch (error) {
                this.log(2, '❌ Error refreshing session key:', error);
                this.showError('Failed to refresh session key: ' + error.message);
                return null;
            }
        }
        
        async getSessionKey() {
            if (this.currentSessionKey) {
                this.log(7, '🔑 Using cached session key');
                return this.currentSessionKey;
            }
            
            this.log(5, '🔑 Getting initial session key...');
            return await this.refreshSessionKey();
        }
        
        startKeyRefreshTimer() {
            // Refresh key every 50 seconds (10 second buffer before 60s expiry)
            this.keyRefreshInterval = setInterval(async () => {
                await this.refreshSessionKey();
            }, 50000);
            this.log(6, '⏰ Started key refresh timer (every 50 seconds)');
        }
        
        stopKeyRefreshTimer() {
            if (this.keyRefreshInterval) {
                clearInterval(this.keyRefreshInterval);
                this.keyRefreshInterval = null;
                this.log(6, '⏰ Stopped key refresh timer');
            }
        }
        
        // ========== AUDIO PLAYBACK ==========
        async speakText(text, language = null) {
            return new Promise(async (resolve, reject) => {
                try {
                    // Auto-detect language if not specified
                    if (!language) {
                        language = this.detectLanguage(text);
                    }
                    
                    this.log(4, `🎙️ Playing audio for "${text}" in ${language}`);
                    
                    // Determine if this is native or learning speed based on language
                    const isNativeLanguage = (language === this.sourceLanguage);
                    const speedMode = isNativeLanguage ? 'native' : 'learning';
                    
                    this.log(6, `🎯 Speed mode: ${speedMode} (${isNativeLanguage ? 'normal speed' : 'slow/clear'})`);
                    
                    // Generate filename using same logic as server-side script
                    const filename = await this.generateAudioFilename(text);
                    const audioUrl = `${this.options.audioPath}${language}/${speedMode}/${filename}`;
                    
                    this.log(6, `🔊 Loading audio from: ${audioUrl}`);
                    
                    // Load and play the audio file
                    await this.playAudioFromUrl(audioUrl);
                    resolve();
                    
                } catch (error) {
                    this.log(3, '❌ Error playing audio:', error);
                    this.showError('Audio playback failed: ' + error.message);
                    reject(error);
                }
            });
        }
        
        /**
         * Generate audio filename using same logic as server-side script
         * Now uses SHA-256 instead of MD5 for better compatibility
         */
        async generateAudioFilename(text) {
            // Convert to UTF-8 bytes first, then sanitize byte by byte to match server behavior
            const utf8Bytes = this.stringToUtf8Bytes(text);
            
            // Take first 20 bytes (not characters) and convert each byte to char
            const first20Bytes = utf8Bytes.slice(0, 20);
            let sanitized = '';
            
            for (let i = 0; i < first20Bytes.length; i++) {
                const byte = first20Bytes[i];
                const char = String.fromCharCode(byte);
                
                // Replace non-alphanumeric with underscore (same regex as server: [^a-zA-Z0-9])
                if (/[a-zA-Z0-9]/.test(char)) {
                    sanitized += char;
                } else {
                    sanitized += '_';
                }
            }
            
            // Remove trailing underscores
            sanitized = sanitized.replace(/_+$/, '');
            
            if (!sanitized) {
                sanitized = 'phrase';
            }
            
            // Generate SHA-256 hash of original text
            const hash = await this.sha256(text);
            
            // Take first 8 characters of hash to match typical hash length expectations
            const shortHash = hash.substring(0, 8);
            
            return `${sanitized}_${shortHash}.mp3`;
        }
        
        /**
         * SHA-256 hash implementation using Web Crypto API
         * This will work consistently across modern browsers and match server-side implementations
         */
        async sha256(str) {
            // Convert string to UTF-8 bytes
            const utf8Bytes = new TextEncoder().encode(str);
            
            // Generate SHA-256 hash
            const hashBuffer = await crypto.subtle.digest('SHA-256', utf8Bytes);
            
            // Convert buffer to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
            
            return hashHex;
        }
        
        /**
         * Convert string to UTF-8 byte array
         */
        stringToUtf8Bytes(str) {
            const bytes = [];
            for (let i = 0; i < str.length; i++) {
                let code = str.charCodeAt(i);
                if (code < 0x80) {
                    bytes.push(code);
                } else if (code < 0x800) {
                    bytes.push(0xC0 | (code >> 6));
                    bytes.push(0x80 | (code & 0x3F));
                } else if (code < 0x10000) {
                    bytes.push(0xE0 | (code >> 12));
                    bytes.push(0x80 | ((code >> 6) & 0x3F));
                    bytes.push(0x80 | (code & 0x3F));
                } else {
                    bytes.push(0xF0 | (code >> 18));
                    bytes.push(0x80 | ((code >> 12) & 0x3F));
                    bytes.push(0x80 | ((code >> 6) & 0x3F));
                    bytes.push(0x80 | (code & 0x3F));
                }
            }
            return bytes;
        }
        
        /**
         * Load and play audio from URL
         */
        async playAudioFromUrl(url) {
            return new Promise((resolve, reject) => {
                try {
                    this.log(6, '🔊 Creating audio element for playback');
                    
                    const audio = new Audio();
                    
                    audio.onloadeddata = () => {
                        this.log(7, '✅ Audio loaded successfully');
                    };
                    
                    audio.onended = () => {
                        this.log(6, '✅ Audio playback finished');
                        resolve();
                    };
                    
                    audio.onerror = (error) => {
                        this.log(3, '❌ Audio playback error:', error);
                        reject(new Error(`Failed to load audio from ${url}`));
                    };
                    
                    audio.oncanplaythrough = () => {
                        this.log(7, '▶️ Starting audio playback');
                        audio.play().catch(playError => {
                            this.log(3, '❌ Audio play() failed:', playError);
                            reject(playError);
                        });
                    };
                    
                    // Set source and start loading
                    audio.src = url;
                    audio.load();
                    
                } catch (error) {
                    this.log(3, '❌ Error setting up audio playback:', error);
                    reject(error);
                }
            });
        }

        /**
         * Play a portion of audio file as a hint (first 25% of duration)
         */
        async playAudioHint(text, language = null, speedMode = 'learning') {
            return new Promise(async (resolve, reject) => {
                try {
                    // Use target language if not specified
                    if (!language) {
                        language = this.targetLanguage;
                    }
                    
                    this.log(5, `🎯 Playing audio hint for: "${text}" in ${language}`);
                    
                    // Generate filename using same logic as speakText method
                    const filename = await this.generateAudioFilename(text);
                    const audioUrl = `${this.options.audioPath}${language}/${speedMode}/${filename}`;
                    
                    this.log(6, `🔊 Loading hint audio from: ${audioUrl}`);
                    
                    const audio = new Audio();
                    
                    audio.onloadedmetadata = () => {
                        this.log(7, `✅ Audio metadata loaded, duration: ${audio.duration}s`);
                        
                        // Calculate hint duration based on configurable percentage
                        const hintDuration = audio.duration * this.options.audioHintDuration;
                        this.log(7, `🎯 Playing first ${hintDuration.toFixed(2)}s as hint (${(this.options.audioHintDuration * 100)}% of ${audio.duration.toFixed(2)}s)`);
                        
                        // Set up a timer to stop playback after configured duration
                        const stopTimer = setTimeout(() => {
                            audio.pause();
                            audio.currentTime = 0;
                            this.log(7, '🔇 Hint playback completed');
                            resolve();
                        }, hintDuration * 1000);
                        
                        // Clean up timer if audio ends naturally (shouldn't happen with hints)
                        audio.onended = () => {
                            clearTimeout(stopTimer);
                            this.log(7, '🔇 Audio hint ended naturally');
                            resolve();
                        };
                        
                        // Start playback
                        audio.play().catch(playError => {
                            clearTimeout(stopTimer);
                            this.log(3, '❌ Audio hint play() failed:', playError);
                            reject(playError);
                        });
                    };
                    
                    audio.onerror = (error) => {
                        this.log(3, '❌ Audio hint error:', error);
                        reject(new Error(`Failed to load audio hint from ${audioUrl}`));
                    };
                    
                    // Set source and start loading
                    audio.src = audioUrl;
                    audio.load();
                    
                } catch (error) {
                    this.log(3, '❌ Error setting up audio hint:', error);
                    reject(error);
                }
            });
        }

        /**
         * Determine if an audio hint should be played based on phrase history and word count
         */
        shouldPlayHint(targetText, recentResults) {
            // Validate inputs
            if (!recentResults || recentResults.length === 0) {
                this.log(8, '🎯 No hint: no recent results');
                return false;
            }
            
            // Check word count - skip hints for short phrases
            const wordCount = targetText.trim().split(/\s+/).length;
            if (wordCount < this.options.audioHintMinWords) {
                this.log(8, `🎯 No hint: phrase too short (${wordCount} words < ${this.options.audioHintMinWords} minimum)`);
                return false;
            }
            
            // Count successes (1s) and calculate success rate
            const successCount = recentResults.filter(r => r === 1).length;
            const totalAttempts = recentResults.length;
            const successRate = successCount / totalAttempts;
            
            this.log(8, `🎯 Hint check: ${successCount}/${totalAttempts} success rate: ${successRate.toFixed(2)}, words: ${wordCount}`, recentResults);
            
            // Only play hint if:
            // 1. User has had at least some success (successCount > 0)
            // 2. But success rate is below 50% (struggling)
            // 3. And has attempted the phrase at least twice (to have meaningful history)
            const hasAttemptedMultipleTimes = totalAttempts >= 2;
            const hasSomeSuccess = successCount > 0;
            const isStruggling = successRate < 0.5;
            
            const shouldHint = hasAttemptedMultipleTimes && hasSomeSuccess && isStruggling;
            
            this.log(8, `🎯 Hint decision: attempts=${totalAttempts} >= 2: ${hasAttemptedMultipleTimes}, successes=${successCount} > 0: ${hasSomeSuccess}, struggling=${successRate.toFixed(2)} < 0.5: ${isStruggling}`);
            this.log(8, `🎯 Should play hint: ${shouldHint}`);
            
            return shouldHint;
        }

        
        // ========== LEARNING SESSION MANAGEMENT ==========
        /**
         * Start a learning session with persistent microphone access
         * Call this once when learning starts to avoid repeated mic requests
         */
        async startLearningSession() {
            if (this.isLearningSessionActive) {
                this.log(6, '🎓 Learning session already active');
                return;
            }
            
            this.log(5, '🎓 Starting learning session with persistent microphone');
            await this.startRecording();
            this.isLearningSessionActive = true;
        }
        
        /**
         * Stop the learning session and release microphone access
         * Call this when the user finishes learning or closes the app
         */
        stopLearningSession() {
            if (!this.isLearningSessionActive) {
                this.log(6, '🎓 No learning session to stop');
                return;
            }
            
            this.log(5, '🎓 Stopping learning session and releasing microphone');
            this.stopRecording();
            this.isLearningSessionActive = false;
        }
        
        /**
         * Check if a learning session is currently active
         */
        isSessionActive() {
            return this.isLearningSessionActive;
        }
        
        // ========== AUDIO RECORDING ==========
        async startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        sampleRate: 24000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    } 
                });
                
                this.currentAudioStream = stream;
                this.audioContext = new AudioContext({ sampleRate: 24000 });
                const source = this.audioContext.createMediaStreamSource(stream);
                
                this.audioProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
                this.audioProcessor.onaudioprocess = (event) => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isListening) {
                        const audioData = event.inputBuffer.getChannelData(0);
                        const pcm16 = new Int16Array(audioData.length);
                        
                        for (let i = 0; i < audioData.length; i++) {
                            pcm16[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
                        }
                        
                        const uint8Array = new Uint8Array(pcm16.buffer);
                        const base64Audio = btoa(String.fromCharCode.apply(null, uint8Array));
                        
                        this.ws.send(JSON.stringify({
                            type: 'input_audio_buffer.append',
                            audio: base64Audio
                        }));
                    }
                };
                
                source.connect(this.audioProcessor);
                this.audioProcessor.connect(this.audioContext.destination);
                
                this.isListening = true;
                this.log(5, '🎤 Started recording and listening');
                
            } catch (error) {
                this.log(2, 'Error starting recording:', error);
                this.showError('Could not access microphone: ' + error.message);
                throw error;
            }
        }
        
        pauseListening() {
            this.isListening = false;
            this.log(6, '⏸️ Paused listening (microphone still active)');
        }
        
        resumeListening() {
            this.isListening = true;
            this.log(6, '▶️ Resumed listening');
        }
        
        stopRecording() {
            this.isListening = false;
            
            if (this.currentAudioStream) {
                this.currentAudioStream.getTracks().forEach(track => track.stop());
                this.currentAudioStream = null;
            }
            
            if (this.audioProcessor) {
                this.audioProcessor.disconnect();
                this.audioProcessor = null;
            }
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.log(5, '🛑 Stopped recording completely');
        }
        
        // Simple language detection based on known source/target languages
        detectLanguage(text) {
            // This is a simple heuristic - in a real app you might use a more sophisticated approach
            // For now, assume shorter phrases or common English words are source language
            const englishWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
            const words = text.toLowerCase().split(/\s+/);
            const englishWordCount = words.filter(word => englishWords.includes(word)).length;
            
            // If more than 20% are common English words, assume it's the source language
            if (englishWordCount / words.length > 0.2) {
                return this.sourceLanguage;
            }
            
            // Otherwise assume target language
            return this.targetLanguage;
        }
        
        // ========== UI HELPERS ==========
        showStatus(message) {
            this.log(7, '📢 Status:', message);
            
            // Call status callback if provided
            if (this.options.statusCallback) {
                this.options.statusCallback(message);
            }
            
            // Update output element if provided
            if (this.outputElement) {
                this.outputElement.textContent = message;
            }
        }
        
        showError(message) {
            this.log(2, '❌ Error:', message);
            // Could emit an event or call a callback here
            if (this.outputElement) {
                this.outputElement.textContent = 'Error: ' + message;
                this.outputElement.style.color = 'red';
                setTimeout(() => {
                    this.outputElement.style.color = '';
                }, 3000);
            }
        }
        
        showScore(score) {
            this.log(4, '📊 Score:', score);
            // Return score info for UI to handle
            return {
                score: score,
                message: this.getScoreMessage(score),
                emoji: this.getScoreEmoji(score)
            };
        }
        
        getScoreMessage(score) {
            if (score >= 8) return 'Excellent work!';
            if (score >= 6) return 'Good job!';
            return 'Keep practicing!';
        }
        
        getScoreEmoji(score) {
            if (score >= 8) return '🎉';
            if (score >= 6) return '👍';
            return '📚';
        }
        
        // ========== OPTIONS MANAGEMENT ==========
        updateOptions(newOptions) {
            this.log(5, '🔧 Updating tutor options:', newOptions);
            
            // Merge new options with existing ones
            this.options = this.mergeOptions(this.options, newOptions);
            
            this.log(6, '✅ Options updated:', this.options);
            return this.options;
        }
        
        getOptions() {
            return { ...this.options }; // Return a copy to prevent external modification
        }
        
        // ========== MAIN TEST FUNCTION ==========
        async test(sourceText, targetText, expectedPronunciation = '', recentResults = [], waitTime = 10) {
            try {
                this.showStatus('Getting session key...');
                const sessionKey = await this.getSessionKey();
                if (!sessionKey) {
                    return {
                        score: 0,
                        commentary: 'Failed to get session key',
                        stop: false
                    };
                }
                
                this.showStatus('Connecting to ChatGPT...');
                this.log(4, '🔗 Creating new ChatGPT WebSocket connection for testing');
                this.log(6, '🎚️ Using VAD settings:', this.options.vad);
                this.log(6, '🎯 Feedback threshold:', this.options.feedbackThreshold);
                
                // Connect to ChatGPT Realtime API
                this.ws = new WebSocket(
                    'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview&openai-beta=realtime%3Dv1',
                    [`realtime`, `openai-insecure-api-key.${sessionKey}`, "openai-beta.realtime-v1"]
                );
                
                return new Promise((resolve) => {
                    let hasResponse = false;
                    let silenceTimer;
                    
                    this.ws.onopen = async () => {
                        this.log(5, '✅ Connected to ChatGPT Realtime API');
                        
                        // Prepare the prompt for ChatGPT
                        const prompt = `You are an expert phonetician. Listen to the user's speech and provide ONLY a English "phrasebook respelling" transcription of what they said. Do not include any explanations, commentary, or additional text except for these special cases - if the user says any of these, return JUST the standardized word instead of a transcription:
- If they say "stop", "pause", "that's enough", "quit", "finish", "done" or similar: return "stop"
- If they say "again", "play it again", "repeat", "one more time" or similar: return "again" 
- If they say "skip", "next", "pass", "I don't know", "I give up" or similar: return "skip"
- If they remain completely silent or you hear nothing: return "silent"

Please provide the phonetic transcription using English phrasebook respelling using ALL CAPS to show where the speaker puts emphasis using the following phonemes:
ah, eh, ay, ee, oh, oo, aw, ew, ur, uh, ow, ahn, ehn, ohn, uhn, p, b, t, d, k, g, f, v, s, z, m, n, l, r, rr, sh, zh, ch, j, ny, ly, h, th, w, y
The user is speaking in ${this.targetLanguage}
`;

                        if (this.options.loggingVerbosity >= 8) {
                            this.log(8, '📤 Sending prompt to ChatGPT:');
                            this.log(8, '------- PROMPT START -------');
                            this.log(8, prompt);
                            this.log(8, '------- PROMPT END -------');
                        }
                        
                        // Configure session with dynamic language instructions and custom VAD
                        this.ws.send(JSON.stringify({
                            type: 'session.update',
                            session: {
                                modalities: ['text'],
                                instructions: prompt,
                                input_audio_format: 'pcm16',
                                input_audio_transcription: {
                                    model: 'whisper-1'
                                },
                                turn_detection: {
                                    type: 'server_vad',
                                    threshold: this.options.vad.threshold,
                                    prefix_padding_ms: this.options.vad.prefixPaddingMs,
                                    silence_duration_ms: this.options.vad.silenceDurationMs
                                }
                            }
                        }));
                        
                        // Ensure we have an active learning session
                        if (!this.isLearningSessionActive) {
                            this.log(2, '❌ test() called without active learning session');
                            return {
                                score: 0,
                                commentary: 'No active learning session. Please start a learning session first.',
                                stop: true
                            };
                        }
                        
                        this.log(6, '🎤 Using persistent microphone session');
                        
                        // Check if this is a brand new phrase (zero correct answers in history)
                        const correctAnswers = recentResults.reduce((sum, result) => sum + result, 0);
                        const isNewPhrase = correctAnswers === 0;
                        if (isNewPhrase ) {
                            // For completely new phrases, introduce them properly
                            this.showStatus(`🎵 New phrase! Listen to this ${this.sourceLanguage} phrase...`);
                            this.pauseListening();
                            await this.speakText(sourceText, this.sourceLanguage);
                            
                            this.showStatus(`🎵 Now here's how to say it in ${this.targetLanguage}...`);
                            await this.speakText(targetText, this.targetLanguage);
                            // repeat it
                            // Pause for 1 second (1000 milliseconds)
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            await this.speakText(targetText, this.targetLanguage);
                            
                            this.showStatus(`🎤 Now you try! Say it in ${this.targetLanguage}...`);
                            
                            // Play notification bleep before resuming listening
                            await this.playNotificationBleep();
                            this.resumeListening();
                        } else {
                            // Regular flow for phrases with some history
                            this.showStatus(`🎵 Listen to this ${this.sourceLanguage} phrase...`);
                            this.pauseListening();
                            await this.speakText(sourceText, this.sourceLanguage);
                            
                            // Check if we should play an audio hint
                            if (this.options.enableAudioHints && this.shouldPlayHint(targetText, recentResults)) {
                                try {
                                    this.showStatus("🎯 Here is a hint for you...");
                                    this.log(6, '🎯 Playing audio hint for struggling phrase');
                                    await this.playAudioHint(targetText);
                                    await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause after hint
                                } catch (error) {
                                    this.log(4, '⚠️ Audio hint failed:', error);
                                    // Continue with normal flow even if hint fails
                                }
                            }
                            
                            this.showStatus(`🎤 Now say it in ${this.targetLanguage}...`);
                            
                            // Play notification bleep before resuming listening
                            await this.playNotificationBleep();
                            this.resumeListening();
                        }
                        
                        // Set silence timer
                        silenceTimer = setTimeout(() => {
                            if (!hasResponse) {
                                this.log(4, '⏰ Silence timeout reached');
                                this.cleanup();
                                resolve({
                                    score: 0,
                                    commentary: 'No response detected within the time limit. Please try speaking closer to the microphone or check your audio settings.',
                                    stop: false
                                });
                            }
                        }, waitTime * 1000);
                    };
                    
                    this.ws.onmessage = async (event) => {
                        const message = JSON.parse(event.data);
                        this.log(8, '📨 Received message:', message.type);
                        
                        // Debug: Log full message for important types
                        if (['response.done', 'error', 'response.text.delta'].includes(message.type)) {
                            this.log(9, '📋 Full message details:', message);
                        }
                        
                        if (message.type === 'session.updated') {
                            this.log(6, '✅ Session configured successfully');
                        }
                        
                        if (message.type === 'input_audio_buffer.speech_started') {
                            this.log(6, '🎤 Speech detected, user started speaking');
                            clearTimeout(silenceTimer);
                        }
                        
                        if (message.type === 'input_audio_buffer.speech_stopped') {
                            this.log(6, '🔇 Speech stopped, processing...');
                        }
                        
                        if (message.type === 'response.done') {
                            this.log(5, '✅ Response complete from ChatGPT');
                            hasResponse = true;
                            clearTimeout(silenceTimer);
                            
                            // Extract response from ChatGPT
                            const response = message.response;
                            let result = {
                                score: 0,
                                commentary: 'Unable to process response',
                                stop: false
                            };
                            
                            this.log(6, '🔍 Processing ChatGPT response...');
                            this.log(9, '📥 Raw response object:', JSON.stringify(response, null, 2));
                            
                            if (response.output && response.output.length > 0) {
                                for (const output of response.output) {
                                    this.log(8, '📄 Processing output item:', output);
                                    if (output.content && output.content.length > 0) {
                                        for (const content of output.content) {
                                            if (content.type === 'text' && content.text) {
                                                if (this.options.loggingVerbosity >= 7) {
                                                    this.log(7, '📥 Raw ChatGPT response text:');
                                                    this.log(7, '------- RESPONSE START -------');
                                                    this.log(7, content.text);
                                                    this.log(7, '------- RESPONSE END -------');
                                                }
                                                
                                                // ChatGPT now returns phonetic transcription or standardized special words
                                                const response = content.text.trim();
                                                this.log(6, '🎤 ChatGPT response:', response);
                                                
                                                // Check for standardized special cases
                                                if (response === 'stop') {
                                                    result = {
                                                        score: 0,
                                                        heardPronunciation: response,
                                                        commentary: 'User requested to stop',
                                                        stop: true
                                                    };
                                                    this.log(5, '🛑 Stop command detected');
                                                }
                                                else if (response === 'again') {
                                                    result = {
                                                        score: 0,
                                                        heardPronunciation: response,
                                                        commentary: "They'll hear it again",
                                                        stop: false
                                                    };
                                                    this.log(5, '🔄 Repeat request detected');
                                                }
                                                else if (response === 'skip') {
                                                    result = {
                                                        score: 1,
                                                        heardPronunciation: response,
                                                        commentary: 'Try your best! Practice makes perfect.',
                                                        stop: false
                                                    };
                                                    this.log(5, '🤷 Skip/don\'t know response detected');
                                                }
                                                else if (response === 'silent') {
                                                    result = {
                                                        score: 0,
                                                        heardPronunciation: '',
                                                        commentary: 'No response detected',
                                                        stop: false
                                                    };
                                                    this.log(5, '🔇 Silent response detected');
                                                }
                                                // Normal pronunciation scoring
                                                else if (response.length > 0) {
                                                    let scoringResult;
                                                    
                                                    // Handle both string and array pronunciations
                                                    if (Array.isArray(expectedPronunciation)) {
                                                        // Array of pronunciation options - test against all and take the best score
                                                        this.log(6, `🎯 Testing against ${expectedPronunciation.length} pronunciation options:`, expectedPronunciation);
                                                        
                                                        let bestResult = null;
                                                        let bestScore = -1;
                                                        
                                                        for (let i = 0; i < expectedPronunciation.length; i++) {
                                                            const option = expectedPronunciation[i];
                                                            const testResult = this.pronunciationScorer.score(option, response);
                                                            this.log(7, `📊 Option ${i + 1} "${option}": ${testResult.finalScore.toFixed(1)}/10`);
                                                            
                                                            if (testResult.finalScore > bestScore) {
                                                                bestScore = testResult.finalScore;
                                                                bestResult = testResult;
                                                                bestResult.matchedPronunciation = option; // Track which option matched best
                                                            }
                                                        }
                                                        
                                                        scoringResult = bestResult;
                                                        this.log(6, `🏆 Best match: "${scoringResult.matchedPronunciation}" with score ${scoringResult.finalScore.toFixed(1)}/10`);
                                                    } else {
                                                        // Single string pronunciation (traditional behavior)
                                                        scoringResult = this.pronunciationScorer.score(expectedPronunciation, response);
                                                        this.log(6, `📊 Single pronunciation scoring: ${scoringResult.finalScore.toFixed(1)}/10`);
                                                    }
                                                    
                                                    result = {
                                                        score: scoringResult.finalScore,
                                                        targetPronunciation: expectedPronunciation,
                                                        heardPronunciation: response,
                                                        commentary: `Score: ${scoringResult.finalScore.toFixed(1)}/10 (${scoringResult.grade})`,
                                                        stop: false,
                                                        matchedPronunciation: scoringResult.matchedPronunciation // Include which option was matched (only for arrays)
                                                    };
                                                    this.log(5, '📊 Scored pronunciation:', result);
                                                }
                                                // Empty response fallback
                                                else {
                                                    result = {
                                                        score: 0,
                                                        heardPronunciation: '',
                                                        commentary: 'No response received',
                                                        stop: false
                                                    };
                                                    this.log(5, '🔇 Empty response');
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                this.log(3, '⚠️ No output found in ChatGPT response');
                            }
                            
                            // If user requested to stop, clean up and return immediately
                            if (result.stop) {
                                this.log(4, '🛑 User requested to stop');
                                this.cleanup();
                                resolve(result);
                                return;
                            }
                            
                            // Play audio feedback based on score
                            if (result.score > 0) {
                                // Determine pass/fail based on pass threshold (not feedback threshold)
                                const passed = result.score >= this.options.passThreshold;
                                this.log(6, `🎵 Playing ${passed ? 'success' : 'failure'} bleep for score ${result.score} (pass threshold: ${this.options.passThreshold})`);
                                
                                // Play appropriate feedback bleep (don't await to avoid blocking)
                                if (passed) {
                                    this.playSuccessBleep().catch(err => this.log(4, 'Success bleep failed:', err));
                                } else {
                                    this.playFailureBleep().catch(err => this.log(4, 'Failure bleep failed:', err));
                                }
                            }
                            
                            // Show score feedback and potentially play target pronunciation
                            this.showStatus('Test complete!');
                            const scoreInfo = this.showScore(result.score);
                            
                            // Speak target language if score is below or equal to configured threshold
                            if (result.score > 0 && result.score <= this.options.feedbackThreshold) {
                                this.log(5, `📢 Score ${result.score} below threshold ${this.options.feedbackThreshold}, speaking ${this.targetLanguage} target phrase...`);
                                
                                const wasListening = this.isListening;
                                if (wasListening) this.pauseListening();
                                
                                // Show what was heard before playing the correct pronunciation
                                if (result.heardPronunciation && result.heardPronunciation.length > 0) {
                                    this.showStatus(`👂 I heard you say: "${result.heardPronunciation}"`);
                                    this.log(6, `👂 Displaying heard pronunciation: "${result.heardPronunciation}"`);
                                }
                                
                                // For very poor scores (< 3), repeat the phrase 3 times
                                if (result.score < 3) {
                                    this.log(4, `🔁 Score ${result.score} is very low, repeating target phrase 3 times for better learning`);
                                    this.showStatus(`🎵 Score ${result.score}/10 - Here's the correct ${this.targetLanguage} pronunciation (3 times)...`);
                                    
                                    for (let i = 1; i <= 3; i++) {
                                        this.log(6, `🎵 Playing repetition ${i}/3`);
                                        await this.speakText(targetText, this.targetLanguage);
                                        
                                        // Short pause between repetitions (except after the last one)
                                        if (i < 3) {
                                            await new Promise(resolve => setTimeout(resolve, 800));
                                        }
                                    }
                                } else {
                                    // Normal single playback for scores 3-6 (below threshold but not terrible)
                                    this.showStatus(`🎵 Here's the correct ${this.targetLanguage} pronunciation...`);
                                    await this.speakText(targetText, this.targetLanguage);
                                }
                                
                                if (wasListening) this.resumeListening();
                            }
                            
                            this.log(4, '📊 Final result returned:', result);
                            this.cleanup();
                            resolve(result);
                        }
                        
                        if (message.type === 'error') {
                            this.log(2, '❌ ChatGPT WebSocket error:', message.error);
                            this.log(8, '💥 Full error details:', JSON.stringify(message, null, 2));
                            this.showError('Error: ' + message.error.message);
                            this.cleanup();
                            resolve({
                                score: 0,
                                commentary: `Error occurred: ${message.error.message}`,
                                stop: false
                            });
                        }
                    };
                    
                    this.ws.onerror = (error) => {
                        this.log(2, '❌ WebSocket connection error:', error);
                        this.showError('Connection error occurred');
                        this.cleanup();
                        resolve({
                            score: 0,
                            commentary: 'Connection error occurred. Please check your internet connection and try again.',
                            stop: false
                        });
                    };
                });
                
            } catch (error) {
                this.log(1, '💥 Error in test method:', error);
                this.log(8, '🔍 Error stack trace:', error.stack);
                this.showError('Error: ' + error.message);
                return {
                    score: 0,
                    commentary: `Error occurred: ${error.message}`,
                    stop: false
                };
            }
        }
        
        cleanup() {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.log(5, '🔌 Closing ChatGPT WebSocket connection');
                this.ws.close();
                this.ws = null;
            }
            
            // Only stop recording if we're not in a persistent learning session
            if (!this.isLearningSessionActive) {
                this.log(6, '🎤 Stopping temporary recording session');
                this.stopRecording();
            } else {
                this.log(6, '🎤 Keeping persistent microphone session active');
            }
        }
        
        // ========== LIFECYCLE MANAGEMENT ==========
        destroy() {
            this.log(4, '🧹 Destroying LanguageTutor instance');
            this.cleanup();
            this.stopKeyRefreshTimer();
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    // settingsStore.js - Centralised settings management with localStorage persistence

    // Default settings
    const defaultSettings = {
      // Language Configuration
      nativeLanguage: 'English',
      learningLanguage: 'Italian',
      
      // Display Options
      showExpectedOutput: 'always', // 'always', 'never', 'struggling'
      showCategory: true,
      showFeedback: true,
      showUpcomingQueue: false,
      enableAudioHints: false,
      
      // Audio & Timing Controls
      translationThreshold: 7,
      pauseBetweenTests: 3,
      pauseWhenStruggling: 5,
      
      // Binary Algorithm Controls
      passThreshold: 7,
      repetitivenessFactor: 5,
      
      // Developer Settings
      loggingVerbosity: 5,
      showDeveloperSettings: false,
      
      // Category Preferences
      enabledCategories: {}
    };

    function createSettingsStore() {
      const { subscribe, set, update } = writable(defaultSettings);
      
      return {
        subscribe,
        
        // Load settings from localStorage
        load: () => {
          if (typeof localStorage === 'undefined') return;
          
          const saved = localStorage.getItem('languageTutorSettings');
          if (saved) {
            try {
              const parsedSettings = JSON.parse(saved);
              update(current => ({ ...current, ...parsedSettings }));
              console.log('✅ Settings loaded from localStorage');
            } catch (error) {
              console.error('❌ Failed to parse saved settings:', error);
            }
          }
        },
        
        // Save settings to localStorage
        save: (settings) => {
          if (typeof localStorage === 'undefined') return;
          
          try {
            localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
            console.log('💾 Settings saved to localStorage');
          } catch (error) {
            console.error('❌ Failed to save settings:', error);
          }
        },
        
        // Update specific setting
        updateSetting: (key, value) => {
          update(current => {
            const newSettings = { ...current, [key]: value };
            
            // Auto-save to localStorage
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem('languageTutorSettings', JSON.stringify(newSettings));
              } catch (error) {
                console.error('❌ Failed to save setting:', error);
              }
            }
            
            return newSettings;
          });
        },
        
        // Update multiple settings at once
        updateSettings: (updates) => {
          update(current => {
            const newSettings = { ...current, ...updates };
            
            // Auto-save to localStorage
            if (typeof localStorage !== 'undefined') {
              try {
                localStorage.setItem('languageTutorSettings', JSON.stringify(newSettings));
              } catch (error) {
                console.error('❌ Failed to save settings:', error);
              }
            }
            
            return newSettings;
          });
        },
        
        // Reset to defaults
        reset: () => {
          set(defaultSettings);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('languageTutorSettings');
          }
        }
      };
    }

    const settings = createSettingsStore();

    // autoSave.js - Reusable Svelte action for auto-saving settings to localStorage

    function autoSave(node, settingName) {
      function handleChange(event) {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        
        if (settingName && typeof localStorage !== 'undefined') {
          try {
            const saved = localStorage.getItem('languageTutorSettings');
            const settings = saved ? JSON.parse(saved) : {};
            settings[settingName] = value;
            localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
            console.log(`💾 Saved ${settingName}:`, value);
          } catch (error) {
            console.error(`Failed to save ${settingName}:`, error);
          }
        }
      }
      
      node.addEventListener('change', handleChange);
      
      return {
        destroy() {
          node.removeEventListener('change', handleChange);
        }
      };
    }

    /* src/LanguageSettings.svelte generated by Svelte v3.59.2 */

    const { console: console_1$2 } = globals;
    const file$7 = "src/LanguageSettings.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (31:6) {#each nativeLanguages as lang}
    function create_each_block_1(ctx) {
    	let option;
    	let t0_value = /*lang*/ ctx[9] + "";
    	let t0;
    	let t1;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = option_value_value = /*lang*/ ctx[9];
    			option.value = option.__value;
    			add_location(option, file$7, 31, 8, 792);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*nativeLanguages*/ 4 && t0_value !== (t0_value = /*lang*/ ctx[9] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*nativeLanguages*/ 4 && option_value_value !== (option_value_value = /*lang*/ ctx[9])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(31:6) {#each nativeLanguages as lang}",
    		ctx
    	});

    	return block;
    }

    // (46:6) {#each learningLanguages as lang}
    function create_each_block$2(ctx) {
    	let option;
    	let t0_value = /*lang*/ ctx[9] + "";
    	let t0;
    	let t1;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = space();
    			option.__value = option_value_value = /*lang*/ ctx[9];
    			option.value = option.__value;
    			add_location(option, file$7, 46, 8, 1140);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*learningLanguages*/ 8 && t0_value !== (t0_value = /*lang*/ ctx[9] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*learningLanguages*/ 8 && option_value_value !== (option_value_value = /*lang*/ ctx[9])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(46:6) {#each learningLanguages as lang}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let h3;
    	let t1;
    	let div2;
    	let div0;
    	let label0;
    	let t3;
    	let select0;
    	let t4;
    	let div1;
    	let label1;
    	let t6;
    	let select1;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*nativeLanguages*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*learningLanguages*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Language Selection";
    			t1 = space();
    			div2 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Native Language";
    			t3 = space();
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t4 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Learning Language";
    			t6 = space();
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file$7, 21, 0, 468);
    			attr_dev(label0, "class", "form-label");
    			add_location(label0, file$7, 24, 4, 578);
    			attr_dev(select0, "class", "form-select");
    			if (/*nativeLanguage*/ ctx[0] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[5].call(select0));
    			add_location(select0, file$7, 25, 4, 632);
    			attr_dev(div0, "class", "form-group");
    			add_location(div0, file$7, 23, 2, 549);
    			attr_dev(label1, "class", "form-label");
    			add_location(label1, file$7, 39, 4, 918);
    			attr_dev(select1, "class", "form-select");
    			if (/*learningLanguage*/ ctx[1] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[6].call(select1));
    			add_location(select1, file$7, 40, 4, 974);
    			attr_dev(div1, "class", "form-group");
    			add_location(div1, file$7, 38, 2, 889);
    			attr_dev(div2, "class", "language-grid");
    			add_location(div2, file$7, 22, 0, 519);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			select_option(select0, /*nativeLanguage*/ ctx[0], true);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t6);
    			append_dev(div1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			select_option(select1, /*learningLanguage*/ ctx[1], true);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[5]),
    					action_destroyer(autoSave.call(null, select0, "nativeLanguage")),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[6]),
    					action_destroyer(autoSave.call(null, select1, "learningLanguage"))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*nativeLanguages*/ 4) {
    				each_value_1 = /*nativeLanguages*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*nativeLanguage, nativeLanguages*/ 5) {
    				select_option(select0, /*nativeLanguage*/ ctx[0]);
    			}

    			if (dirty & /*learningLanguages*/ 8) {
    				each_value = /*learningLanguages*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*learningLanguage, learningLanguages*/ 10) {
    				select_option(select1, /*learningLanguage*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('LanguageSettings', slots, []);
    	let { nativeLanguage } = $$props;
    	let { learningLanguage } = $$props;
    	let { nativeLanguages } = $$props;
    	let { learningLanguages } = $$props;
    	let { loggingVerbosity = 5 } = $$props;
    	const dispatch = createEventDispatcher();

    	function log(level, ...args) {
    		if (loggingVerbosity >= level) {
    			console.log(...args);
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (nativeLanguage === undefined && !('nativeLanguage' in $$props || $$self.$$.bound[$$self.$$.props['nativeLanguage']])) {
    			console_1$2.warn("<LanguageSettings> was created without expected prop 'nativeLanguage'");
    		}

    		if (learningLanguage === undefined && !('learningLanguage' in $$props || $$self.$$.bound[$$self.$$.props['learningLanguage']])) {
    			console_1$2.warn("<LanguageSettings> was created without expected prop 'learningLanguage'");
    		}

    		if (nativeLanguages === undefined && !('nativeLanguages' in $$props || $$self.$$.bound[$$self.$$.props['nativeLanguages']])) {
    			console_1$2.warn("<LanguageSettings> was created without expected prop 'nativeLanguages'");
    		}

    		if (learningLanguages === undefined && !('learningLanguages' in $$props || $$self.$$.bound[$$self.$$.props['learningLanguages']])) {
    			console_1$2.warn("<LanguageSettings> was created without expected prop 'learningLanguages'");
    		}
    	});

    	const writable_props = [
    		'nativeLanguage',
    		'learningLanguage',
    		'nativeLanguages',
    		'learningLanguages',
    		'loggingVerbosity'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<LanguageSettings> was created with unknown prop '${key}'`);
    	});

    	function select0_change_handler() {
    		nativeLanguage = select_value(this);
    		$$invalidate(0, nativeLanguage);
    		$$invalidate(2, nativeLanguages);
    	}

    	function select1_change_handler() {
    		learningLanguage = select_value(this);
    		$$invalidate(1, learningLanguage);
    		$$invalidate(3, learningLanguages);
    	}

    	$$self.$$set = $$props => {
    		if ('nativeLanguage' in $$props) $$invalidate(0, nativeLanguage = $$props.nativeLanguage);
    		if ('learningLanguage' in $$props) $$invalidate(1, learningLanguage = $$props.learningLanguage);
    		if ('nativeLanguages' in $$props) $$invalidate(2, nativeLanguages = $$props.nativeLanguages);
    		if ('learningLanguages' in $$props) $$invalidate(3, learningLanguages = $$props.learningLanguages);
    		if ('loggingVerbosity' in $$props) $$invalidate(4, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		autoSave,
    		nativeLanguage,
    		learningLanguage,
    		nativeLanguages,
    		learningLanguages,
    		loggingVerbosity,
    		dispatch,
    		log
    	});

    	$$self.$inject_state = $$props => {
    		if ('nativeLanguage' in $$props) $$invalidate(0, nativeLanguage = $$props.nativeLanguage);
    		if ('learningLanguage' in $$props) $$invalidate(1, learningLanguage = $$props.learningLanguage);
    		if ('nativeLanguages' in $$props) $$invalidate(2, nativeLanguages = $$props.nativeLanguages);
    		if ('learningLanguages' in $$props) $$invalidate(3, learningLanguages = $$props.learningLanguages);
    		if ('loggingVerbosity' in $$props) $$invalidate(4, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		nativeLanguage,
    		learningLanguage,
    		nativeLanguages,
    		learningLanguages,
    		loggingVerbosity,
    		select0_change_handler,
    		select1_change_handler
    	];
    }

    class LanguageSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			nativeLanguage: 0,
    			learningLanguage: 1,
    			nativeLanguages: 2,
    			learningLanguages: 3,
    			loggingVerbosity: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LanguageSettings",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get nativeLanguage() {
    		throw new Error("<LanguageSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nativeLanguage(value) {
    		throw new Error("<LanguageSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get learningLanguage() {
    		throw new Error("<LanguageSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set learningLanguage(value) {
    		throw new Error("<LanguageSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nativeLanguages() {
    		throw new Error("<LanguageSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nativeLanguages(value) {
    		throw new Error("<LanguageSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get learningLanguages() {
    		throw new Error("<LanguageSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set learningLanguages(value) {
    		throw new Error("<LanguageSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get loggingVerbosity() {
    		throw new Error("<LanguageSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loggingVerbosity(value) {
    		throw new Error("<LanguageSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/DisplaySettings.svelte generated by Svelte v3.59.2 */
    const file$6 = "src/DisplaySettings.svelte";

    // (83:52) 
    function create_if_block_3$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Expected translation shown only for phrases with success rate below 25%");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(83:52) ",
    		ctx
    	});

    	return block;
    }

    // (81:47) 
    function create_if_block_2$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Expected translation is never shown - test your memory!");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(81:47) ",
    		ctx
    	});

    	return block;
    }

    // (79:6) {#if showExpectedOutput === 'always'}
    function create_if_block_1$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Expected translation is always shown");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(79:6) {#if showExpectedOutput === 'always'}",
    		ctx
    	});

    	return block;
    }

    // (142:2) {#if showExpectedOutput === 'struggling'}
    function create_if_block$5(ctx) {
    	let div1;
    	let label;
    	let t0;
    	let t1;
    	let t2;
    	let span0;
    	let t4;
    	let input;
    	let t5;
    	let div0;
    	let span1;
    	let t7;
    	let span2;
    	let t9;
    	let span3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			label = element("label");
    			t0 = text("Pause When Struggling: ");
    			t1 = text(/*pauseWhenStruggling*/ ctx[7]);
    			t2 = text("s\n      ");
    			span0 = element("span");
    			span0.textContent = "Extra pause time for phrases with low success rate (<25%) or poor scores (<4)";
    			t4 = space();
    			input = element("input");
    			t5 = space();
    			div0 = element("div");
    			span1 = element("span");
    			span1.textContent = "Quick (0.5s)";
    			t7 = space();
    			span2 = element("span");
    			span2.textContent = "Default (5s)";
    			t9 = space();
    			span3 = element("span");
    			span3.textContent = "Extended (15s)";
    			attr_dev(span0, "class", "threshold-description");
    			add_location(span0, file$6, 145, 6, 4464);
    			attr_dev(label, "class", "form-label");
    			add_location(label, file$6, 143, 4, 4379);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0.5");
    			attr_dev(input, "max", "15");
    			attr_dev(input, "step", "0.5");
    			attr_dev(input, "class", "threshold-slider");
    			add_location(input, file$6, 149, 4, 4624);
    			add_location(span1, file$6, 159, 6, 4863);
    			add_location(span2, file$6, 160, 6, 4895);
    			add_location(span3, file$6, 161, 6, 4927);
    			attr_dev(div0, "class", "threshold-labels");
    			add_location(div0, file$6, 158, 4, 4826);
    			attr_dev(div1, "class", "threshold-setting");
    			add_location(div1, file$6, 142, 4, 4343);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, label);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, t2);
    			append_dev(label, span0);
    			append_dev(div1, t4);
    			append_dev(div1, input);
    			set_input_value(input, /*pauseWhenStruggling*/ ctx[7]);
    			append_dev(div1, t5);
    			append_dev(div1, div0);
    			append_dev(div0, span1);
    			append_dev(div0, t7);
    			append_dev(div0, span2);
    			append_dev(div0, t9);
    			append_dev(div0, span3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[16]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[16]),
    					action_destroyer(autoSave.call(null, input, "pauseWhenStruggling"))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pauseWhenStruggling*/ 128) set_data_dev(t1, /*pauseWhenStruggling*/ ctx[7]);

    			if (dirty & /*pauseWhenStruggling*/ 128) {
    				set_input_value(input, /*pauseWhenStruggling*/ ctx[7]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(142:2) {#if showExpectedOutput === 'struggling'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let h3;
    	let t1;
    	let div6;
    	let div0;
    	let label0;
    	let input0;
    	let t2;
    	let span0;
    	let t4;
    	let label1;
    	let input1;
    	let t5;
    	let span1;
    	let t7;
    	let label2;
    	let input2;
    	let t8;
    	let span2;
    	let t10;
    	let label3;
    	let input3;
    	let t11;
    	let span3;
    	let t13;
    	let div1;
    	let label4;
    	let t15;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let t19;
    	let p;
    	let t20;
    	let div3;
    	let label5;
    	let t21;
    	let t22;
    	let t23;
    	let span4;

    	let t24_value = (/*translationThreshold*/ ctx[5] === 0
    	? 'Never repeat translation'
    	: /*translationThreshold*/ ctx[5] === 10
    		? 'Always repeat translation'
    		: `Repeat translation for scores below ${/*translationThreshold*/ ctx[5]}`) + "";

    	let t24;
    	let t25;
    	let input4;
    	let t26;
    	let div2;
    	let span5;
    	let t28;
    	let span6;
    	let t30;
    	let span7;
    	let t32;
    	let div5;
    	let label6;
    	let t33;
    	let t34;
    	let t35;
    	let span8;

    	let t36_value = (/*pauseBetweenTests*/ ctx[6] <= 1
    	? 'Quick - brief pause for score review'
    	: /*pauseBetweenTests*/ ctx[6] >= 5
    		? 'Slow - plenty of time to read feedback'
    		: 'Balanced - comfortable time to review your score') + "";

    	let t36;
    	let t37;
    	let input5;
    	let t38;
    	let div4;
    	let span9;
    	let t40;
    	let span10;
    	let t42;
    	let span11;
    	let t44;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showExpectedOutput*/ ctx[0] === 'always') return create_if_block_1$2;
    		if (/*showExpectedOutput*/ ctx[0] === 'never') return create_if_block_2$1;
    		if (/*showExpectedOutput*/ ctx[0] === 'struggling') return create_if_block_3$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = /*showExpectedOutput*/ ctx[0] === 'struggling' && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Display Options";
    			t1 = space();
    			div6 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t2 = space();
    			span0 = element("span");
    			span0.textContent = "Display Category";
    			t4 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t5 = space();
    			span1 = element("span");
    			span1.textContent = "Display Feedback";
    			t7 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t8 = space();
    			span2 = element("span");
    			span2.textContent = "Show Upcoming Queue";
    			t10 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t11 = space();
    			span3 = element("span");
    			span3.textContent = "Enable Audio Hints";
    			t13 = space();
    			div1 = element("div");
    			label4 = element("label");
    			label4.textContent = "Show Expected Translation";
    			t15 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Always";
    			option1 = element("option");
    			option1.textContent = "Only when struggling";
    			option2 = element("option");
    			option2.textContent = "Never";
    			t19 = space();
    			p = element("p");
    			if (if_block0) if_block0.c();
    			t20 = space();
    			div3 = element("div");
    			label5 = element("label");
    			t21 = text("Translation Repetition Threshold: ");
    			t22 = text(/*translationThreshold*/ ctx[5]);
    			t23 = space();
    			span4 = element("span");
    			t24 = text(t24_value);
    			t25 = space();
    			input4 = element("input");
    			t26 = space();
    			div2 = element("div");
    			span5 = element("span");
    			span5.textContent = "Never (0)";
    			t28 = space();
    			span6 = element("span");
    			span6.textContent = "Default (7)";
    			t30 = space();
    			span7 = element("span");
    			span7.textContent = "Always (10)";
    			t32 = space();
    			div5 = element("div");
    			label6 = element("label");
    			t33 = text("Pause Between Tests: ");
    			t34 = text(/*pauseBetweenTests*/ ctx[6]);
    			t35 = text("s\n      ");
    			span8 = element("span");
    			t36 = text(t36_value);
    			t37 = space();
    			input5 = element("input");
    			t38 = space();
    			div4 = element("div");
    			span9 = element("span");
    			span9.textContent = "Quick (0.5s)";
    			t40 = space();
    			span10 = element("span");
    			span10.textContent = "Default (3s)";
    			t42 = space();
    			span11 = element("span");
    			span11.textContent = "Slow (10s)";
    			t44 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file$6, 22, 0, 513);
    			attr_dev(input0, "type", "checkbox");
    			attr_dev(input0, "class", "category-checkbox");
    			add_location(input0, file$6, 26, 6, 676);
    			attr_dev(span0, "class", "category-label");
    			add_location(span0, file$6, 32, 6, 832);
    			attr_dev(label0, "class", "category-item");
    			add_location(label0, file$6, 25, 4, 640);
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "class", "category-checkbox");
    			add_location(input1, file$6, 35, 6, 938);
    			attr_dev(span1, "class", "category-label");
    			add_location(span1, file$6, 41, 6, 1094);
    			attr_dev(label1, "class", "category-item");
    			add_location(label1, file$6, 34, 4, 902);
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "class", "category-checkbox");
    			add_location(input2, file$6, 44, 6, 1200);
    			attr_dev(span2, "class", "category-label");
    			add_location(span2, file$6, 51, 6, 1398);
    			attr_dev(label2, "class", "category-item");
    			add_location(label2, file$6, 43, 4, 1164);
    			attr_dev(input3, "type", "checkbox");
    			attr_dev(input3, "class", "category-checkbox");
    			add_location(input3, file$6, 54, 6, 1507);
    			attr_dev(span3, "class", "category-label");
    			add_location(span3, file$6, 60, 6, 1671);
    			attr_dev(label3, "class", "category-item");
    			add_location(label3, file$6, 53, 4, 1471);
    			attr_dev(div0, "class", "display-options-list svelte-6s5pe4");
    			add_location(div0, file$6, 24, 2, 601);
    			attr_dev(label4, "class", "form-label");
    			attr_dev(label4, "for", "expected-output-select");
    			add_location(label4, file$6, 66, 4, 1854);
    			option0.__value = "always";
    			option0.value = option0.__value;
    			add_location(option0, file$6, 73, 6, 2109);
    			option1.__value = "struggling";
    			option1.value = option1.__value;
    			add_location(option1, file$6, 74, 6, 2154);
    			option2.__value = "never";
    			option2.value = option2.__value;
    			add_location(option2, file$6, 75, 6, 2217);
    			attr_dev(select, "id", "expected-output-select");
    			attr_dev(select, "class", "form-select");
    			if (/*showExpectedOutput*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[13].call(select));
    			add_location(select, file$6, 67, 4, 1947);
    			attr_dev(p, "class", "setting-description");
    			add_location(p, file$6, 77, 4, 2272);
    			attr_dev(div1, "class", "form-group expected-translation-section svelte-6s5pe4");
    			add_location(div1, file$6, 65, 2, 1796);
    			attr_dev(span4, "class", "threshold-description");
    			add_location(span4, file$6, 92, 6, 2846);
    			attr_dev(label5, "class", "form-label");
    			add_location(label5, file$6, 90, 4, 2750);
    			attr_dev(input4, "type", "range");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "max", "10");
    			attr_dev(input4, "step", "1");
    			attr_dev(input4, "class", "threshold-slider");
    			add_location(input4, file$6, 98, 4, 3124);
    			add_location(span5, file$6, 108, 6, 3361);
    			add_location(span6, file$6, 109, 6, 3390);
    			add_location(span7, file$6, 110, 6, 3421);
    			attr_dev(div2, "class", "threshold-labels");
    			add_location(div2, file$6, 107, 4, 3324);
    			attr_dev(div3, "class", "threshold-setting");
    			add_location(div3, file$6, 89, 2, 2714);
    			attr_dev(span8, "class", "threshold-description");
    			add_location(span8, file$6, 118, 6, 3627);
    			attr_dev(label6, "class", "form-label");
    			add_location(label6, file$6, 116, 4, 3546);
    			attr_dev(input5, "type", "range");
    			attr_dev(input5, "min", "0.5");
    			attr_dev(input5, "max", "10");
    			attr_dev(input5, "step", "0.5");
    			attr_dev(input5, "class", "threshold-slider");
    			add_location(input5, file$6, 124, 4, 3908);
    			add_location(span9, file$6, 134, 6, 4143);
    			add_location(span10, file$6, 135, 6, 4175);
    			add_location(span11, file$6, 136, 6, 4207);
    			attr_dev(div4, "class", "threshold-labels");
    			add_location(div4, file$6, 133, 4, 4106);
    			attr_dev(div5, "class", "threshold-setting");
    			add_location(div5, file$6, 115, 2, 3510);
    			attr_dev(div6, "class", "display-options-section");
    			add_location(div6, file$6, 23, 0, 561);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div0);
    			append_dev(div0, label0);
    			append_dev(label0, input0);
    			input0.checked = /*showCategory*/ ctx[1];
    			append_dev(label0, t2);
    			append_dev(label0, span0);
    			append_dev(div0, t4);
    			append_dev(div0, label1);
    			append_dev(label1, input1);
    			input1.checked = /*showFeedback*/ ctx[2];
    			append_dev(label1, t5);
    			append_dev(label1, span1);
    			append_dev(div0, t7);
    			append_dev(div0, label2);
    			append_dev(label2, input2);
    			input2.checked = /*showUpcomingQueue*/ ctx[3];
    			append_dev(label2, t8);
    			append_dev(label2, span2);
    			append_dev(div0, t10);
    			append_dev(div0, label3);
    			append_dev(label3, input3);
    			input3.checked = /*enableAudioHints*/ ctx[4];
    			append_dev(label3, t11);
    			append_dev(label3, span3);
    			append_dev(div6, t13);
    			append_dev(div6, div1);
    			append_dev(div1, label4);
    			append_dev(div1, t15);
    			append_dev(div1, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			select_option(select, /*showExpectedOutput*/ ctx[0], true);
    			append_dev(div1, t19);
    			append_dev(div1, p);
    			if (if_block0) if_block0.m(p, null);
    			append_dev(div6, t20);
    			append_dev(div6, div3);
    			append_dev(div3, label5);
    			append_dev(label5, t21);
    			append_dev(label5, t22);
    			append_dev(label5, t23);
    			append_dev(label5, span4);
    			append_dev(span4, t24);
    			append_dev(div3, t25);
    			append_dev(div3, input4);
    			set_input_value(input4, /*translationThreshold*/ ctx[5]);
    			append_dev(div3, t26);
    			append_dev(div3, div2);
    			append_dev(div2, span5);
    			append_dev(div2, t28);
    			append_dev(div2, span6);
    			append_dev(div2, t30);
    			append_dev(div2, span7);
    			append_dev(div6, t32);
    			append_dev(div6, div5);
    			append_dev(div5, label6);
    			append_dev(label6, t33);
    			append_dev(label6, t34);
    			append_dev(label6, t35);
    			append_dev(label6, span8);
    			append_dev(span8, t36);
    			append_dev(div5, t37);
    			append_dev(div5, input5);
    			set_input_value(input5, /*pauseBetweenTests*/ ctx[6]);
    			append_dev(div5, t38);
    			append_dev(div5, div4);
    			append_dev(div4, span9);
    			append_dev(div4, t40);
    			append_dev(div4, span10);
    			append_dev(div4, t42);
    			append_dev(div4, span11);
    			append_dev(div6, t44);
    			if (if_block1) if_block1.m(div6, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[9]),
    					action_destroyer(autoSave.call(null, input0, "showCategory")),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[10]),
    					action_destroyer(autoSave.call(null, input1, "showFeedback")),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*updateQueue*/ ctx[8], false, false, false, false),
    					action_destroyer(autoSave.call(null, input2, "showUpcomingQueue")),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[12]),
    					action_destroyer(autoSave.call(null, input3, "enableAudioHints")),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[13]),
    					action_destroyer(autoSave.call(null, select, "showExpectedOutput")),
    					listen_dev(input4, "change", /*input4_change_input_handler*/ ctx[14]),
    					listen_dev(input4, "input", /*input4_change_input_handler*/ ctx[14]),
    					action_destroyer(autoSave.call(null, input4, "translationThreshold")),
    					listen_dev(input5, "change", /*input5_change_input_handler*/ ctx[15]),
    					listen_dev(input5, "input", /*input5_change_input_handler*/ ctx[15]),
    					action_destroyer(autoSave.call(null, input5, "pauseBetweenTests"))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*showCategory*/ 2) {
    				input0.checked = /*showCategory*/ ctx[1];
    			}

    			if (dirty & /*showFeedback*/ 4) {
    				input1.checked = /*showFeedback*/ ctx[2];
    			}

    			if (dirty & /*showUpcomingQueue*/ 8) {
    				input2.checked = /*showUpcomingQueue*/ ctx[3];
    			}

    			if (dirty & /*enableAudioHints*/ 16) {
    				input3.checked = /*enableAudioHints*/ ctx[4];
    			}

    			if (dirty & /*showExpectedOutput*/ 1) {
    				select_option(select, /*showExpectedOutput*/ ctx[0]);
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(p, null);
    				}
    			}

    			if (dirty & /*translationThreshold*/ 32) set_data_dev(t22, /*translationThreshold*/ ctx[5]);

    			if (dirty & /*translationThreshold*/ 32 && t24_value !== (t24_value = (/*translationThreshold*/ ctx[5] === 0
    			? 'Never repeat translation'
    			: /*translationThreshold*/ ctx[5] === 10
    				? 'Always repeat translation'
    				: `Repeat translation for scores below ${/*translationThreshold*/ ctx[5]}`) + "")) set_data_dev(t24, t24_value);

    			if (dirty & /*translationThreshold*/ 32) {
    				set_input_value(input4, /*translationThreshold*/ ctx[5]);
    			}

    			if (dirty & /*pauseBetweenTests*/ 64) set_data_dev(t34, /*pauseBetweenTests*/ ctx[6]);

    			if (dirty & /*pauseBetweenTests*/ 64 && t36_value !== (t36_value = (/*pauseBetweenTests*/ ctx[6] <= 1
    			? 'Quick - brief pause for score review'
    			: /*pauseBetweenTests*/ ctx[6] >= 5
    				? 'Slow - plenty of time to read feedback'
    				: 'Balanced - comfortable time to review your score') + "")) set_data_dev(t36, t36_value);

    			if (dirty & /*pauseBetweenTests*/ 64) {
    				set_input_value(input5, /*pauseBetweenTests*/ ctx[6]);
    			}

    			if (/*showExpectedOutput*/ ctx[0] === 'struggling') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$5(ctx);
    					if_block1.c();
    					if_block1.m(div6, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div6);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DisplaySettings', slots, []);
    	let { showExpectedOutput } = $$props;
    	let { showCategory } = $$props;
    	let { showFeedback } = $$props;
    	let { showUpcomingQueue } = $$props;
    	let { enableAudioHints } = $$props;
    	let { translationThreshold } = $$props;
    	let { pauseBetweenTests } = $$props;
    	let { pauseWhenStruggling } = $$props;
    	const dispatch = createEventDispatcher();

    	function updateQueue() {
    		dispatch('updateQueue');
    	}

    	$$self.$$.on_mount.push(function () {
    		if (showExpectedOutput === undefined && !('showExpectedOutput' in $$props || $$self.$$.bound[$$self.$$.props['showExpectedOutput']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'showExpectedOutput'");
    		}

    		if (showCategory === undefined && !('showCategory' in $$props || $$self.$$.bound[$$self.$$.props['showCategory']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'showCategory'");
    		}

    		if (showFeedback === undefined && !('showFeedback' in $$props || $$self.$$.bound[$$self.$$.props['showFeedback']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'showFeedback'");
    		}

    		if (showUpcomingQueue === undefined && !('showUpcomingQueue' in $$props || $$self.$$.bound[$$self.$$.props['showUpcomingQueue']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'showUpcomingQueue'");
    		}

    		if (enableAudioHints === undefined && !('enableAudioHints' in $$props || $$self.$$.bound[$$self.$$.props['enableAudioHints']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'enableAudioHints'");
    		}

    		if (translationThreshold === undefined && !('translationThreshold' in $$props || $$self.$$.bound[$$self.$$.props['translationThreshold']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'translationThreshold'");
    		}

    		if (pauseBetweenTests === undefined && !('pauseBetweenTests' in $$props || $$self.$$.bound[$$self.$$.props['pauseBetweenTests']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'pauseBetweenTests'");
    		}

    		if (pauseWhenStruggling === undefined && !('pauseWhenStruggling' in $$props || $$self.$$.bound[$$self.$$.props['pauseWhenStruggling']])) {
    			console.warn("<DisplaySettings> was created without expected prop 'pauseWhenStruggling'");
    		}
    	});

    	const writable_props = [
    		'showExpectedOutput',
    		'showCategory',
    		'showFeedback',
    		'showUpcomingQueue',
    		'enableAudioHints',
    		'translationThreshold',
    		'pauseBetweenTests',
    		'pauseWhenStruggling'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<DisplaySettings> was created with unknown prop '${key}'`);
    	});

    	function input0_change_handler() {
    		showCategory = this.checked;
    		$$invalidate(1, showCategory);
    	}

    	function input1_change_handler() {
    		showFeedback = this.checked;
    		$$invalidate(2, showFeedback);
    	}

    	function input2_change_handler() {
    		showUpcomingQueue = this.checked;
    		$$invalidate(3, showUpcomingQueue);
    	}

    	function input3_change_handler() {
    		enableAudioHints = this.checked;
    		$$invalidate(4, enableAudioHints);
    	}

    	function select_change_handler() {
    		showExpectedOutput = select_value(this);
    		$$invalidate(0, showExpectedOutput);
    	}

    	function input4_change_input_handler() {
    		translationThreshold = to_number(this.value);
    		$$invalidate(5, translationThreshold);
    	}

    	function input5_change_input_handler() {
    		pauseBetweenTests = to_number(this.value);
    		$$invalidate(6, pauseBetweenTests);
    	}

    	function input_change_input_handler() {
    		pauseWhenStruggling = to_number(this.value);
    		$$invalidate(7, pauseWhenStruggling);
    	}

    	$$self.$$set = $$props => {
    		if ('showExpectedOutput' in $$props) $$invalidate(0, showExpectedOutput = $$props.showExpectedOutput);
    		if ('showCategory' in $$props) $$invalidate(1, showCategory = $$props.showCategory);
    		if ('showFeedback' in $$props) $$invalidate(2, showFeedback = $$props.showFeedback);
    		if ('showUpcomingQueue' in $$props) $$invalidate(3, showUpcomingQueue = $$props.showUpcomingQueue);
    		if ('enableAudioHints' in $$props) $$invalidate(4, enableAudioHints = $$props.enableAudioHints);
    		if ('translationThreshold' in $$props) $$invalidate(5, translationThreshold = $$props.translationThreshold);
    		if ('pauseBetweenTests' in $$props) $$invalidate(6, pauseBetweenTests = $$props.pauseBetweenTests);
    		if ('pauseWhenStruggling' in $$props) $$invalidate(7, pauseWhenStruggling = $$props.pauseWhenStruggling);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		autoSave,
    		showExpectedOutput,
    		showCategory,
    		showFeedback,
    		showUpcomingQueue,
    		enableAudioHints,
    		translationThreshold,
    		pauseBetweenTests,
    		pauseWhenStruggling,
    		dispatch,
    		updateQueue
    	});

    	$$self.$inject_state = $$props => {
    		if ('showExpectedOutput' in $$props) $$invalidate(0, showExpectedOutput = $$props.showExpectedOutput);
    		if ('showCategory' in $$props) $$invalidate(1, showCategory = $$props.showCategory);
    		if ('showFeedback' in $$props) $$invalidate(2, showFeedback = $$props.showFeedback);
    		if ('showUpcomingQueue' in $$props) $$invalidate(3, showUpcomingQueue = $$props.showUpcomingQueue);
    		if ('enableAudioHints' in $$props) $$invalidate(4, enableAudioHints = $$props.enableAudioHints);
    		if ('translationThreshold' in $$props) $$invalidate(5, translationThreshold = $$props.translationThreshold);
    		if ('pauseBetweenTests' in $$props) $$invalidate(6, pauseBetweenTests = $$props.pauseBetweenTests);
    		if ('pauseWhenStruggling' in $$props) $$invalidate(7, pauseWhenStruggling = $$props.pauseWhenStruggling);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showExpectedOutput,
    		showCategory,
    		showFeedback,
    		showUpcomingQueue,
    		enableAudioHints,
    		translationThreshold,
    		pauseBetweenTests,
    		pauseWhenStruggling,
    		updateQueue,
    		input0_change_handler,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler,
    		select_change_handler,
    		input4_change_input_handler,
    		input5_change_input_handler,
    		input_change_input_handler
    	];
    }

    class DisplaySettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			showExpectedOutput: 0,
    			showCategory: 1,
    			showFeedback: 2,
    			showUpcomingQueue: 3,
    			enableAudioHints: 4,
    			translationThreshold: 5,
    			pauseBetweenTests: 6,
    			pauseWhenStruggling: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DisplaySettings",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get showExpectedOutput() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showExpectedOutput(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showCategory() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showCategory(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showFeedback() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showFeedback(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showUpcomingQueue() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showUpcomingQueue(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get enableAudioHints() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set enableAudioHints(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translationThreshold() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translationThreshold(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pauseBetweenTests() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pauseBetweenTests(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pauseWhenStruggling() {
    		throw new Error("<DisplaySettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pauseWhenStruggling(value) {
    		throw new Error("<DisplaySettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/AlgorithmSettings.svelte generated by Svelte v3.59.2 */
    const file$5 = "src/AlgorithmSettings.svelte";

    function create_fragment$5(ctx) {
    	let div4;
    	let h3;
    	let t1;
    	let div1;
    	let label0;
    	let t2;
    	let t3;
    	let t4;
    	let span0;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let input0;
    	let t9;
    	let div0;
    	let span1;
    	let t11;
    	let span2;
    	let t13;
    	let span3;
    	let t15;
    	let div3;
    	let label1;
    	let t16;
    	let t17;
    	let t18;
    	let span4;

    	let t19_value = (/*repetitivenessFactor*/ ctx[1] <= 3
    	? 'Less repetitive - tests advance quickly'
    	: /*repetitivenessFactor*/ ctx[1] >= 8
    		? 'Very repetitive - tests stay at front longer'
    		: 'Balanced repetition') + "";

    	let t19;
    	let t20;
    	let input1;
    	let t21;
    	let div2;
    	let span5;
    	let t23;
    	let span6;
    	let t25;
    	let span7;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Learning Algorithm";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			t2 = text("Pass Threshold: ");
    			t3 = text(/*passThreshold*/ ctx[0]);
    			t4 = space();
    			span0 = element("span");
    			t5 = text("Scores ");
    			t6 = text(/*passThreshold*/ ctx[0]);
    			t7 = text(" and above are considered a pass");
    			t8 = space();
    			input0 = element("input");
    			t9 = space();
    			div0 = element("div");
    			span1 = element("span");
    			span1.textContent = "Easy (1)";
    			t11 = space();
    			span2 = element("span");
    			span2.textContent = "Default (7)";
    			t13 = space();
    			span3 = element("span");
    			span3.textContent = "Hard (10)";
    			t15 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t16 = text("Test Repetitiveness: ");
    			t17 = text(/*repetitivenessFactor*/ ctx[1]);
    			t18 = space();
    			span4 = element("span");
    			t19 = text(t19_value);
    			t20 = space();
    			input1 = element("input");
    			t21 = space();
    			div2 = element("div");
    			span5 = element("span");
    			span5.textContent = "Less (1)";
    			t23 = space();
    			span6 = element("span");
    			span6.textContent = "Default (5)";
    			t25 = space();
    			span7 = element("span");
    			span7.textContent = "More (10)";
    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file$5, 9, 2, 199);
    			attr_dev(span0, "class", "threshold-description");
    			add_location(span0, file$5, 13, 6, 359);
    			attr_dev(label0, "class", "form-label");
    			add_location(label0, file$5, 11, 4, 288);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "1");
    			attr_dev(input0, "max", "10");
    			attr_dev(input0, "step", "1");
    			attr_dev(input0, "class", "threshold-slider");
    			add_location(input0, file$5, 17, 4, 490);
    			add_location(span1, file$5, 27, 6, 713);
    			add_location(span2, file$5, 28, 6, 741);
    			add_location(span3, file$5, 29, 6, 772);
    			attr_dev(div0, "class", "threshold-labels");
    			add_location(div0, file$5, 26, 4, 676);
    			attr_dev(div1, "class", "threshold-setting");
    			add_location(div1, file$5, 10, 2, 252);
    			attr_dev(span4, "class", "threshold-description");
    			add_location(span4, file$5, 36, 6, 939);
    			attr_dev(label1, "class", "form-label");
    			add_location(label1, file$5, 34, 4, 856);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "1");
    			attr_dev(input1, "max", "10");
    			attr_dev(input1, "step", "1");
    			attr_dev(input1, "class", "threshold-slider");
    			add_location(input1, file$5, 42, 4, 1206);
    			add_location(span5, file$5, 52, 6, 1443);
    			add_location(span6, file$5, 53, 6, 1471);
    			add_location(span7, file$5, 54, 6, 1502);
    			attr_dev(div2, "class", "threshold-labels");
    			add_location(div2, file$5, 51, 4, 1406);
    			attr_dev(div3, "class", "threshold-setting");
    			add_location(div3, file$5, 33, 2, 820);
    			attr_dev(div4, "class", "algorithm-settings svelte-1xttx29");
    			add_location(div4, file$5, 8, 0, 164);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h3);
    			append_dev(div4, t1);
    			append_dev(div4, div1);
    			append_dev(div1, label0);
    			append_dev(label0, t2);
    			append_dev(label0, t3);
    			append_dev(label0, t4);
    			append_dev(label0, span0);
    			append_dev(span0, t5);
    			append_dev(span0, t6);
    			append_dev(span0, t7);
    			append_dev(div1, t8);
    			append_dev(div1, input0);
    			set_input_value(input0, /*passThreshold*/ ctx[0]);
    			append_dev(div1, t9);
    			append_dev(div1, div0);
    			append_dev(div0, span1);
    			append_dev(div0, t11);
    			append_dev(div0, span2);
    			append_dev(div0, t13);
    			append_dev(div0, span3);
    			append_dev(div4, t15);
    			append_dev(div4, div3);
    			append_dev(div3, label1);
    			append_dev(label1, t16);
    			append_dev(label1, t17);
    			append_dev(label1, t18);
    			append_dev(label1, span4);
    			append_dev(span4, t19);
    			append_dev(div3, t20);
    			append_dev(div3, input1);
    			set_input_value(input1, /*repetitivenessFactor*/ ctx[1]);
    			append_dev(div3, t21);
    			append_dev(div3, div2);
    			append_dev(div2, span5);
    			append_dev(div2, t23);
    			append_dev(div2, span6);
    			append_dev(div2, t25);
    			append_dev(div2, span7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[2]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[2]),
    					action_destroyer(autoSave.call(null, input0, "passThreshold")),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[3]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[3]),
    					action_destroyer(autoSave.call(null, input1, "repetitivenessFactor"))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*passThreshold*/ 1) set_data_dev(t3, /*passThreshold*/ ctx[0]);
    			if (dirty & /*passThreshold*/ 1) set_data_dev(t6, /*passThreshold*/ ctx[0]);

    			if (dirty & /*passThreshold*/ 1) {
    				set_input_value(input0, /*passThreshold*/ ctx[0]);
    			}

    			if (dirty & /*repetitivenessFactor*/ 2) set_data_dev(t17, /*repetitivenessFactor*/ ctx[1]);

    			if (dirty & /*repetitivenessFactor*/ 2 && t19_value !== (t19_value = (/*repetitivenessFactor*/ ctx[1] <= 3
    			? 'Less repetitive - tests advance quickly'
    			: /*repetitivenessFactor*/ ctx[1] >= 8
    				? 'Very repetitive - tests stay at front longer'
    				: 'Balanced repetition') + "")) set_data_dev(t19, t19_value);

    			if (dirty & /*repetitivenessFactor*/ 2) {
    				set_input_value(input1, /*repetitivenessFactor*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AlgorithmSettings', slots, []);
    	let { passThreshold } = $$props;
    	let { repetitivenessFactor } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (passThreshold === undefined && !('passThreshold' in $$props || $$self.$$.bound[$$self.$$.props['passThreshold']])) {
    			console.warn("<AlgorithmSettings> was created without expected prop 'passThreshold'");
    		}

    		if (repetitivenessFactor === undefined && !('repetitivenessFactor' in $$props || $$self.$$.bound[$$self.$$.props['repetitivenessFactor']])) {
    			console.warn("<AlgorithmSettings> was created without expected prop 'repetitivenessFactor'");
    		}
    	});

    	const writable_props = ['passThreshold', 'repetitivenessFactor'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<AlgorithmSettings> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		passThreshold = to_number(this.value);
    		$$invalidate(0, passThreshold);
    	}

    	function input1_change_input_handler() {
    		repetitivenessFactor = to_number(this.value);
    		$$invalidate(1, repetitivenessFactor);
    	}

    	$$self.$$set = $$props => {
    		if ('passThreshold' in $$props) $$invalidate(0, passThreshold = $$props.passThreshold);
    		if ('repetitivenessFactor' in $$props) $$invalidate(1, repetitivenessFactor = $$props.repetitivenessFactor);
    	};

    	$$self.$capture_state = () => ({
    		autoSave,
    		passThreshold,
    		repetitivenessFactor
    	});

    	$$self.$inject_state = $$props => {
    		if ('passThreshold' in $$props) $$invalidate(0, passThreshold = $$props.passThreshold);
    		if ('repetitivenessFactor' in $$props) $$invalidate(1, repetitivenessFactor = $$props.repetitivenessFactor);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		passThreshold,
    		repetitivenessFactor,
    		input0_change_input_handler,
    		input1_change_input_handler
    	];
    }

    class AlgorithmSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			passThreshold: 0,
    			repetitivenessFactor: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AlgorithmSettings",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get passThreshold() {
    		throw new Error("<AlgorithmSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set passThreshold(value) {
    		throw new Error("<AlgorithmSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get repetitivenessFactor() {
    		throw new Error("<AlgorithmSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set repetitivenessFactor(value) {
    		throw new Error("<AlgorithmSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/CategoryManager.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$1, console: console_1$1 } = globals;
    const file$4 = "src/CategoryManager.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (45:0) {#if categories.length > 0}
    function create_if_block$4(ctx) {
    	let h3;
    	let t1;
    	let div1;
    	let div0;
    	let t2;
    	let show_if = !Object.values(/*enabledCategories*/ ctx[0]).some(func$1);
    	let t3;
    	let style;
    	let each_value = /*categories*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	let if_block = show_if && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Learning Categories";
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			style = element("style");
    			style.textContent = "/* Component-specific styles for CategoryManager */\n  .categories-section {\n    margin-top: 1rem;\n  }\n  \n  .categories-list {\n    margin-top: 0.5rem;\n    display: grid;\n    grid-template-columns: 1fr;\n    gap: 0.5rem;\n  }\n  \n  @media (min-width: 640px) {\n    .categories-list {\n      grid-template-columns: 1fr 1fr;\n    }\n  }\n  \n  /* Fieldset styling for categories */\n  fieldset {\n    border: none;\n    padding: 0;\n    margin: 0;\n  }\n  \n  legend {\n    padding: 0;\n    margin-bottom: 0.5rem;\n  }";
    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file$4, 45, 2, 1514);
    			attr_dev(div0, "class", "categories-list");
    			add_location(div0, file$4, 47, 4, 1605);
    			add_location(style, file$4, 68, 0, 2272);
    			attr_dev(div1, "class", "categories-section");
    			add_location(div1, file$4, 46, 2, 1568);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div0, null);
    				}
    			}

    			append_dev(div1, t2);
    			if (if_block) if_block.m(div1, null);
    			append_dev(div1, t3);
    			append_dev(div1, style);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*categories, enabledCategories, handleCategoryToggle*/ 7) {
    				each_value = /*categories*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*enabledCategories*/ 1) show_if = !Object.values(/*enabledCategories*/ ctx[0]).some(func$1);

    			if (show_if) {
    				if (if_block) ; else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					if_block.m(div1, t3);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(45:0) {#if categories.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (49:6) {#each categories as category}
    function create_each_block$1(ctx) {
    	let label;
    	let input;
    	let input_checked_value;
    	let t0;
    	let span;
    	let t1_value = /*category*/ ctx[7] + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	function change_handler(...args) {
    		return /*change_handler*/ ctx[4](/*category*/ ctx[7], ...args);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "category-checkbox");
    			input.checked = input_checked_value = /*enabledCategories*/ ctx[0][/*category*/ ctx[7]] || false;
    			add_location(input, file$4, 50, 10, 1720);
    			attr_dev(span, "class", "category-label");
    			add_location(span, file$4, 56, 10, 1957);
    			attr_dev(label, "class", "category-item");
    			add_location(label, file$4, 49, 8, 1680);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(span, t1);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", change_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*enabledCategories, categories*/ 3 && input_checked_value !== (input_checked_value = /*enabledCategories*/ ctx[0][/*category*/ ctx[7]] || false)) {
    				prop_dev(input, "checked", input_checked_value);
    			}

    			if (dirty & /*categories*/ 2 && t1_value !== (t1_value = /*category*/ ctx[7] + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(49:6) {#each categories as category}",
    		ctx
    	});

    	return block;
    }

    // (63:4) {#if !Object.values(enabledCategories).some(enabled => enabled)}
    function create_if_block_1$1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "At least one category must be enabled to start learning!";
    			attr_dev(div, "class", "error-text");
    			add_location(div, file$4, 63, 6, 2158);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(63:4) {#if !Object.values(enabledCategories).some(enabled => enabled)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*categories*/ ctx[1].length > 0 && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*categories*/ ctx[1].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func$1 = enabled => enabled;

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CategoryManager', slots, []);
    	let { categories } = $$props;
    	let { enabledCategories } = $$props;
    	let { loggingVerbosity = 5 } = $$props;
    	const dispatch = createEventDispatcher();

    	function log(level, ...args) {
    		if (loggingVerbosity >= level) {
    			console.log(...args);
    		}
    	}

    	function handleCategoryToggle(category, enabled) {
    		log(6, `🔘 Category toggle: ${category} → ${enabled}`);

    		// Update the bound enabledCategories object directly
    		$$invalidate(0, enabledCategories[category] = enabled, enabledCategories);

    		// Force reactivity by creating new object reference
    		$$invalidate(0, enabledCategories = { ...enabledCategories });

    		// Save to localStorage (matching the autoSave pattern)
    		if (typeof localStorage !== 'undefined') {
    			try {
    				const saved = localStorage.getItem('languageTutorSettings');
    				const settings = saved ? JSON.parse(saved) : {};
    				if (!settings.enabledCategories) settings.enabledCategories = {};
    				settings.enabledCategories[category] = enabled;
    				localStorage.setItem('languageTutorSettings', JSON.stringify(settings));
    				console.log(`💾 Saved category ${category}:`, enabled);
    			} catch(error) {
    				console.error(`Failed to save category ${category}:`, error);
    			}
    		}

    		// Dispatch change for LearningQueue updates only
    		dispatch('categoryChange', { category, enabled });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (categories === undefined && !('categories' in $$props || $$self.$$.bound[$$self.$$.props['categories']])) {
    			console_1$1.warn("<CategoryManager> was created without expected prop 'categories'");
    		}

    		if (enabledCategories === undefined && !('enabledCategories' in $$props || $$self.$$.bound[$$self.$$.props['enabledCategories']])) {
    			console_1$1.warn("<CategoryManager> was created without expected prop 'enabledCategories'");
    		}
    	});

    	const writable_props = ['categories', 'enabledCategories', 'loggingVerbosity'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<CategoryManager> was created with unknown prop '${key}'`);
    	});

    	const change_handler = (category, e) => handleCategoryToggle(category, e.target.checked);

    	$$self.$$set = $$props => {
    		if ('categories' in $$props) $$invalidate(1, categories = $$props.categories);
    		if ('enabledCategories' in $$props) $$invalidate(0, enabledCategories = $$props.enabledCategories);
    		if ('loggingVerbosity' in $$props) $$invalidate(3, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		settings,
    		categories,
    		enabledCategories,
    		loggingVerbosity,
    		dispatch,
    		log,
    		handleCategoryToggle
    	});

    	$$self.$inject_state = $$props => {
    		if ('categories' in $$props) $$invalidate(1, categories = $$props.categories);
    		if ('enabledCategories' in $$props) $$invalidate(0, enabledCategories = $$props.enabledCategories);
    		if ('loggingVerbosity' in $$props) $$invalidate(3, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		enabledCategories,
    		categories,
    		handleCategoryToggle,
    		loggingVerbosity,
    		change_handler
    	];
    }

    class CategoryManager extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			categories: 1,
    			enabledCategories: 0,
    			loggingVerbosity: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CategoryManager",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get categories() {
    		throw new Error("<CategoryManager>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set categories(value) {
    		throw new Error("<CategoryManager>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get enabledCategories() {
    		throw new Error("<CategoryManager>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set enabledCategories(value) {
    		throw new Error("<CategoryManager>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get loggingVerbosity() {
    		throw new Error("<CategoryManager>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loggingVerbosity(value) {
    		throw new Error("<CategoryManager>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/DeveloperSettings.svelte generated by Svelte v3.59.2 */
    const file$3 = "src/DeveloperSettings.svelte";

    // (10:0) {#if showDeveloperSettings}
    function create_if_block$3(ctx) {
    	let div3;
    	let h3;
    	let t1;
    	let div2;
    	let label;
    	let t2;
    	let t3;
    	let t4;
    	let span0;

    	let t5_value = (/*loggingVerbosity*/ ctx[0] === 0
    	? 'Silent - no console output'
    	: /*loggingVerbosity*/ ctx[0] <= 3
    		? 'Quiet - errors and warnings only'
    		: /*loggingVerbosity*/ ctx[0] <= 6
    			? 'Normal - important events'
    			: 'Verbose - detailed debugging info') + "";

    	let t5;
    	let t6;
    	let input;
    	let t7;
    	let div0;
    	let span1;
    	let t9;
    	let span2;
    	let t11;
    	let span3;
    	let t13;
    	let div1;
    	let button0;
    	let t15;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			h3 = element("h3");
    			h3.textContent = "🛠️ Developer Settings";
    			t1 = space();
    			div2 = element("div");
    			label = element("label");
    			t2 = text("Console Logging Verbosity: ");
    			t3 = text(/*loggingVerbosity*/ ctx[0]);
    			t4 = space();
    			span0 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			input = element("input");
    			t7 = space();
    			div0 = element("div");
    			span1 = element("span");
    			span1.textContent = "Silent (0)";
    			t9 = space();
    			span2 = element("span");
    			span2.textContent = "Default (5)";
    			t11 = space();
    			span3 = element("span");
    			span3.textContent = "Verbose (10)";
    			t13 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "✅ Pass Next Test";
    			t15 = space();
    			button1 = element("button");
    			button1.textContent = "❌ Fail Next Test";
    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file$3, 11, 4, 285);
    			attr_dev(span0, "class", "threshold-description");
    			add_location(span0, file$3, 15, 8, 489);
    			attr_dev(label, "class", "form-label");
    			add_location(label, file$3, 13, 6, 400);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "10");
    			attr_dev(input, "step", "1");
    			attr_dev(input, "class", "threshold-slider");
    			add_location(input, file$3, 22, 6, 815);
    			add_location(span1, file$3, 31, 8, 1022);
    			add_location(span2, file$3, 32, 8, 1054);
    			add_location(span3, file$3, 33, 8, 1087);
    			attr_dev(div0, "class", "threshold-labels");
    			add_location(div0, file$3, 30, 6, 983);
    			attr_dev(button0, "class", "debug-btn pass-btn svelte-w1gebj");
    			add_location(button0, file$3, 38, 8, 1212);
    			attr_dev(button1, "class", "debug-btn fail-btn svelte-w1gebj");
    			add_location(button1, file$3, 44, 8, 1390);
    			attr_dev(div1, "class", "debug-buttons svelte-w1gebj");
    			add_location(div1, file$3, 37, 6, 1176);
    			attr_dev(div2, "class", "threshold-setting developer-setting svelte-w1gebj");
    			add_location(div2, file$3, 12, 4, 344);
    			attr_dev(div3, "class", "developer-settings svelte-w1gebj");
    			add_location(div3, file$3, 10, 2, 248);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h3);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, label);
    			append_dev(label, t2);
    			append_dev(label, t3);
    			append_dev(label, t4);
    			append_dev(label, span0);
    			append_dev(span0, t5);
    			append_dev(div2, t6);
    			append_dev(div2, input);
    			set_input_value(input, /*loggingVerbosity*/ ctx[0]);
    			append_dev(div2, t7);
    			append_dev(div2, div0);
    			append_dev(div0, span1);
    			append_dev(div0, t9);
    			append_dev(div0, span2);
    			append_dev(div0, t11);
    			append_dev(div0, span3);
    			append_dev(div2, t13);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t15);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[3]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[3]),
    					listen_dev(button0, "click", /*click_handler*/ ctx[4], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*loggingVerbosity*/ 1) set_data_dev(t3, /*loggingVerbosity*/ ctx[0]);

    			if (dirty & /*loggingVerbosity*/ 1 && t5_value !== (t5_value = (/*loggingVerbosity*/ ctx[0] === 0
    			? 'Silent - no console output'
    			: /*loggingVerbosity*/ ctx[0] <= 3
    				? 'Quiet - errors and warnings only'
    				: /*loggingVerbosity*/ ctx[0] <= 6
    					? 'Normal - important events'
    					: 'Verbose - detailed debugging info') + "")) set_data_dev(t5, t5_value);

    			if (dirty & /*loggingVerbosity*/ 1) {
    				set_input_value(input, /*loggingVerbosity*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(10:0) {#if showDeveloperSettings}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*showDeveloperSettings*/ ctx[1] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showDeveloperSettings*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DeveloperSettings', slots, []);
    	let { showDeveloperSettings } = $$props;
    	let { loggingVerbosity } = $$props;
    	const dispatch = createEventDispatcher();

    	$$self.$$.on_mount.push(function () {
    		if (showDeveloperSettings === undefined && !('showDeveloperSettings' in $$props || $$self.$$.bound[$$self.$$.props['showDeveloperSettings']])) {
    			console.warn("<DeveloperSettings> was created without expected prop 'showDeveloperSettings'");
    		}

    		if (loggingVerbosity === undefined && !('loggingVerbosity' in $$props || $$self.$$.bound[$$self.$$.props['loggingVerbosity']])) {
    			console.warn("<DeveloperSettings> was created without expected prop 'loggingVerbosity'");
    		}
    	});

    	const writable_props = ['showDeveloperSettings', 'loggingVerbosity'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<DeveloperSettings> was created with unknown prop '${key}'`);
    	});

    	function input_change_input_handler() {
    		loggingVerbosity = to_number(this.value);
    		$$invalidate(0, loggingVerbosity);
    	}

    	const click_handler = () => dispatch('debugTest', { action: 'pass' });
    	const click_handler_1 = () => dispatch('debugTest', { action: 'fail' });

    	$$self.$$set = $$props => {
    		if ('showDeveloperSettings' in $$props) $$invalidate(1, showDeveloperSettings = $$props.showDeveloperSettings);
    		if ('loggingVerbosity' in $$props) $$invalidate(0, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	$$self.$capture_state = () => ({
    		showDeveloperSettings,
    		loggingVerbosity,
    		createEventDispatcher,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ('showDeveloperSettings' in $$props) $$invalidate(1, showDeveloperSettings = $$props.showDeveloperSettings);
    		if ('loggingVerbosity' in $$props) $$invalidate(0, loggingVerbosity = $$props.loggingVerbosity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		loggingVerbosity,
    		showDeveloperSettings,
    		dispatch,
    		input_change_input_handler,
    		click_handler,
    		click_handler_1
    	];
    }

    class DeveloperSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			showDeveloperSettings: 1,
    			loggingVerbosity: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DeveloperSettings",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get showDeveloperSettings() {
    		throw new Error("<DeveloperSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showDeveloperSettings(value) {
    		throw new Error("<DeveloperSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get loggingVerbosity() {
    		throw new Error("<DeveloperSettings>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loggingVerbosity(value) {
    		throw new Error("<DeveloperSettings>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/LearningSession.svelte generated by Svelte v3.59.2 */
    const file$2 = "src/LearningSession.svelte";

    // (79:2) {:else}
    function create_else_block_1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Ready to start learning";
    			attr_dev(p, "class", "placeholder-text");
    			add_location(p, file$2, 79, 4, 2750);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(79:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (62:2) {#if currentPhrase}
    function create_if_block_3(ctx) {
    	let div;
    	let t0;
    	let p0;
    	let t2;
    	let p1;
    	let t3_value = /*currentPhrase*/ ctx[0].source + "";
    	let t3;
    	let t4;
    	let show_if = /*shouldShowExpectedOutput*/ ctx[7](/*currentPhrase*/ ctx[0]);
    	let t5;
    	let if_block0 = /*showCategory*/ ctx[4] && create_if_block_7(ctx);
    	let if_block1 = show_if && create_if_block_5(ctx);
    	let if_block2 = /*heardPronunciation*/ ctx[6] && create_if_block_4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			p0 = element("p");
    			p0.textContent = "Translate this:";
    			t2 = space();
    			p1 = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			if (if_block1) if_block1.c();
    			t5 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(p0, "class", "phrase-label");
    			add_location(p0, file$2, 66, 6, 2142);
    			attr_dev(p1, "class", "phrase-text");
    			add_location(p1, file$2, 67, 6, 2192);
    			attr_dev(div, "class", "phrase-content");
    			add_location(div, file$2, 62, 4, 1996);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, p0);
    			append_dev(div, t2);
    			append_dev(div, p1);
    			append_dev(p1, t3);
    			append_dev(div, t4);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t5);
    			if (if_block2) if_block2.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (/*showCategory*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_7(ctx);
    					if_block0.c();
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*currentPhrase*/ 1 && t3_value !== (t3_value = /*currentPhrase*/ ctx[0].source + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*currentPhrase*/ 1) show_if = /*shouldShowExpectedOutput*/ ctx[7](/*currentPhrase*/ ctx[0]);

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(div, t5);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*heardPronunciation*/ ctx[6]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_4(ctx);
    					if_block2.c();
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(62:2) {#if currentPhrase}",
    		ctx
    	});

    	return block;
    }

    // (64:6) {#if showCategory}
    function create_if_block_7(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*currentPhrase*/ ctx[0].category + "";
    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Category: ");
    			t1 = text(t1_value);
    			attr_dev(p, "class", "phrase-category");
    			add_location(p, file$2, 64, 8, 2058);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentPhrase*/ 1 && t1_value !== (t1_value = /*currentPhrase*/ ctx[0].category + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(64:6) {#if showCategory}",
    		ctx
    	});

    	return block;
    }

    // (69:6) {#if shouldShowExpectedOutput(currentPhrase)}
    function create_if_block_5(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*currentPhrase*/ ctx[0].target + "";
    	let t1;
    	let t2;
    	let if_block_anchor;
    	let if_block = /*currentPhrase*/ ctx[0].pronunciation && create_if_block_6(ctx);

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Expected: ");
    			t1 = text(t1_value);
    			t2 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(p, "class", "expected-text");
    			add_location(p, file$2, 69, 8, 2302);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			insert_dev(target, t2, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentPhrase*/ 1 && t1_value !== (t1_value = /*currentPhrase*/ ctx[0].target + "")) set_data_dev(t1, t1_value);

    			if (/*currentPhrase*/ ctx[0].pronunciation) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_6(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t2);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(69:6) {#if shouldShowExpectedOutput(currentPhrase)}",
    		ctx
    	});

    	return block;
    }

    // (71:8) {#if currentPhrase.pronunciation}
    function create_if_block_6(ctx) {
    	let p;
    	let t0;

    	let t1_value = (Array.isArray(/*currentPhrase*/ ctx[0].pronunciation)
    	? /*currentPhrase*/ ctx[0].pronunciation[0]
    	: /*currentPhrase*/ ctx[0].pronunciation) + "";

    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Pronunciation: /");
    			t1 = text(t1_value);
    			t2 = text("/");
    			attr_dev(p, "class", "pronunciation-text svelte-aa59dd");
    			add_location(p, file$2, 71, 10, 2416);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*currentPhrase*/ 1 && t1_value !== (t1_value = (Array.isArray(/*currentPhrase*/ ctx[0].pronunciation)
    			? /*currentPhrase*/ ctx[0].pronunciation[0]
    			: /*currentPhrase*/ ctx[0].pronunciation) + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(71:8) {#if currentPhrase.pronunciation}",
    		ctx
    	});

    	return block;
    }

    // (75:6) {#if heardPronunciation}
    function create_if_block_4(ctx) {
    	let p;
    	let t0;
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("You said: /");
    			t1 = text(/*heardPronunciation*/ ctx[6]);
    			t2 = text("/");
    			attr_dev(p, "class", "heard-pronunciation-text svelte-aa59dd");
    			add_location(p, file$2, 75, 8, 2640);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*heardPronunciation*/ 64) set_data_dev(t1, /*heardPronunciation*/ ctx[6]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(75:6) {#if heardPronunciation}",
    		ctx
    	});

    	return block;
    }

    // (92:2) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Ready to start learning!";
    			attr_dev(p, "class", "status-text");
    			add_location(p, file$2, 92, 4, 3134);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(92:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (90:23) 
    function create_if_block_2(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Listening...";
    			attr_dev(p, "class", "status-text");
    			add_location(p, file$2, 90, 4, 3080);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(90:23) ",
    		ctx
    	});

    	return block;
    }

    // (88:64) 
    function create_if_block_1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "🎯 Here is a hint for you";
    			attr_dev(p, "class", "status-text");
    			add_location(p, file$2, 88, 4, 2999);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(88:64) ",
    		ctx
    	});

    	return block;
    }

    // (86:2) {#if showFeedback}
    function create_if_block$2(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*status*/ ctx[1]);
    			attr_dev(p, "class", "status-text");
    			add_location(p, file$2, 86, 4, 2894);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*status*/ 2) set_data_dev(t, /*status*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(86:2) {#if showFeedback}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div0;
    	let t0;
    	let div1;
    	let show_if;
    	let t1;
    	let div2;
    	let button;
    	let span;
    	let t2_value = (/*isLearning*/ ctx[2] ? '⏹️' : '▶️') + "";
    	let t2;
    	let t3;

    	let t4_value = (/*isLearning*/ ctx[2]
    	? 'Stop Learning'
    	: 'Start Learning') + "";

    	let t4;
    	let button_class_value;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*currentPhrase*/ ctx[0]) return create_if_block_3;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (dirty & /*currentPhrase*/ 1) show_if = null;
    		if (/*showFeedback*/ ctx[5]) return create_if_block$2;
    		if (show_if == null) show_if = !!(/*currentPhrase*/ ctx[0] && /*shouldShowAudioHint*/ ctx[8](/*currentPhrase*/ ctx[0]));
    		if (show_if) return create_if_block_1;
    		if (/*isLearning*/ ctx[2]) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_1(ctx, -1);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			if_block1.c();
    			t1 = space();
    			div2 = element("div");
    			button = element("button");
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			t4 = text(t4_value);
    			attr_dev(div0, "class", "phrase-display");
    			add_location(div0, file$2, 60, 0, 1941);
    			attr_dev(div1, "class", "status-area");
    			add_location(div1, file$2, 84, 0, 2843);
    			attr_dev(span, "class", "btn-icon");
    			add_location(span, file$2, 103, 4, 3417);
    			attr_dev(button, "class", button_class_value = "start-stop-btn " + (/*isLearning*/ ctx[2] ? 'stop-btn' : 'start-btn'));
    			button.disabled = button_disabled_value = !/*canStart*/ ctx[3] && !/*isLearning*/ ctx[2];
    			add_location(button, file$2, 98, 2, 3262);
    			attr_dev(div2, "class", "button-container");
    			add_location(div2, file$2, 97, 0, 3229);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			if_block0.m(div0, null);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			if_block1.m(div1, null);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, button);
    			append_dev(button, span);
    			append_dev(span, t2);
    			append_dev(button, t3);
    			append_dev(button, t4);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleStartStop*/ ctx[9], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx, dirty)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			}

    			if (dirty & /*isLearning*/ 4 && t2_value !== (t2_value = (/*isLearning*/ ctx[2] ? '⏹️' : '▶️') + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*isLearning*/ 4 && t4_value !== (t4_value = (/*isLearning*/ ctx[2]
    			? 'Stop Learning'
    			: 'Start Learning') + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*isLearning*/ 4 && button_class_value !== (button_class_value = "start-stop-btn " + (/*isLearning*/ ctx[2] ? 'stop-btn' : 'start-btn'))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty & /*canStart, isLearning*/ 12 && button_disabled_value !== (button_disabled_value = !/*canStart*/ ctx[3] && !/*isLearning*/ ctx[2])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if_block0.d();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if_block1.d();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('LearningSession', slots, []);
    	let { currentPhrase } = $$props;
    	let { status } = $$props;
    	let { isLearning } = $$props;
    	let { canStart } = $$props;
    	let { showCategory } = $$props;
    	let { showFeedback } = $$props;
    	let { showExpectedOutput } = $$props;
    	let { enableAudioHints } = $$props;
    	let { heardPronunciation = '' } = $$props;

    	let { log = (level, ...args) => {
    		
    	} } = $$props;

    	const dispatch = createEventDispatcher();

    	function shouldShowExpectedOutput(phrase) {
    		if (showExpectedOutput === 'always') return true;
    		if (showExpectedOutput === 'never') return false;

    		if (showExpectedOutput === 'struggling') {
    			if (!phrase.recentResults || phrase.recentResults.length === 0) {
    				return true; // Show for new phrases with no history
    			}

    			const successCount = phrase.recentResults.filter(r => r === 1).length;
    			const successRate = successCount / phrase.recentResults.length;
    			return successRate < 0.25;
    		}

    		return true; // Default fallback
    	}

    	function shouldShowAudioHint(phrase) {
    		if (!enableAudioHints || !phrase.recentResults || phrase.recentResults.length === 0) {
    			return false;
    		}

    		const successCount = phrase.recentResults.filter(r => r === 1).length;
    		const successRate = successCount / phrase.recentResults.length;

    		// Show hint if: has some correct attempts (> 0) but success rate is less than 50%
    		return successCount > 0 && successRate < 0.5;
    	}

    	function handleStartStop() {
    		dispatch('startStop');
    	}

    	$$self.$$.on_mount.push(function () {
    		if (currentPhrase === undefined && !('currentPhrase' in $$props || $$self.$$.bound[$$self.$$.props['currentPhrase']])) {
    			console.warn("<LearningSession> was created without expected prop 'currentPhrase'");
    		}

    		if (status === undefined && !('status' in $$props || $$self.$$.bound[$$self.$$.props['status']])) {
    			console.warn("<LearningSession> was created without expected prop 'status'");
    		}

    		if (isLearning === undefined && !('isLearning' in $$props || $$self.$$.bound[$$self.$$.props['isLearning']])) {
    			console.warn("<LearningSession> was created without expected prop 'isLearning'");
    		}

    		if (canStart === undefined && !('canStart' in $$props || $$self.$$.bound[$$self.$$.props['canStart']])) {
    			console.warn("<LearningSession> was created without expected prop 'canStart'");
    		}

    		if (showCategory === undefined && !('showCategory' in $$props || $$self.$$.bound[$$self.$$.props['showCategory']])) {
    			console.warn("<LearningSession> was created without expected prop 'showCategory'");
    		}

    		if (showFeedback === undefined && !('showFeedback' in $$props || $$self.$$.bound[$$self.$$.props['showFeedback']])) {
    			console.warn("<LearningSession> was created without expected prop 'showFeedback'");
    		}

    		if (showExpectedOutput === undefined && !('showExpectedOutput' in $$props || $$self.$$.bound[$$self.$$.props['showExpectedOutput']])) {
    			console.warn("<LearningSession> was created without expected prop 'showExpectedOutput'");
    		}

    		if (enableAudioHints === undefined && !('enableAudioHints' in $$props || $$self.$$.bound[$$self.$$.props['enableAudioHints']])) {
    			console.warn("<LearningSession> was created without expected prop 'enableAudioHints'");
    		}
    	});

    	const writable_props = [
    		'currentPhrase',
    		'status',
    		'isLearning',
    		'canStart',
    		'showCategory',
    		'showFeedback',
    		'showExpectedOutput',
    		'enableAudioHints',
    		'heardPronunciation',
    		'log'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<LearningSession> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('currentPhrase' in $$props) $$invalidate(0, currentPhrase = $$props.currentPhrase);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('isLearning' in $$props) $$invalidate(2, isLearning = $$props.isLearning);
    		if ('canStart' in $$props) $$invalidate(3, canStart = $$props.canStart);
    		if ('showCategory' in $$props) $$invalidate(4, showCategory = $$props.showCategory);
    		if ('showFeedback' in $$props) $$invalidate(5, showFeedback = $$props.showFeedback);
    		if ('showExpectedOutput' in $$props) $$invalidate(10, showExpectedOutput = $$props.showExpectedOutput);
    		if ('enableAudioHints' in $$props) $$invalidate(11, enableAudioHints = $$props.enableAudioHints);
    		if ('heardPronunciation' in $$props) $$invalidate(6, heardPronunciation = $$props.heardPronunciation);
    		if ('log' in $$props) $$invalidate(12, log = $$props.log);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		currentPhrase,
    		status,
    		isLearning,
    		canStart,
    		showCategory,
    		showFeedback,
    		showExpectedOutput,
    		enableAudioHints,
    		heardPronunciation,
    		log,
    		dispatch,
    		shouldShowExpectedOutput,
    		shouldShowAudioHint,
    		handleStartStop
    	});

    	$$self.$inject_state = $$props => {
    		if ('currentPhrase' in $$props) $$invalidate(0, currentPhrase = $$props.currentPhrase);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('isLearning' in $$props) $$invalidate(2, isLearning = $$props.isLearning);
    		if ('canStart' in $$props) $$invalidate(3, canStart = $$props.canStart);
    		if ('showCategory' in $$props) $$invalidate(4, showCategory = $$props.showCategory);
    		if ('showFeedback' in $$props) $$invalidate(5, showFeedback = $$props.showFeedback);
    		if ('showExpectedOutput' in $$props) $$invalidate(10, showExpectedOutput = $$props.showExpectedOutput);
    		if ('enableAudioHints' in $$props) $$invalidate(11, enableAudioHints = $$props.enableAudioHints);
    		if ('heardPronunciation' in $$props) $$invalidate(6, heardPronunciation = $$props.heardPronunciation);
    		if ('log' in $$props) $$invalidate(12, log = $$props.log);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*currentPhrase, log*/ 4097) {
    			// Debug: Log current phrase data
    			if (currentPhrase) {
    				log(8, '🎯 LearningSession currentPhrase:', {
    					source: currentPhrase.source,
    					target: currentPhrase.target,
    					pronunciation: currentPhrase.pronunciation,
    					hasPronunciation: !!currentPhrase.pronunciation,
    					fullPhrase: currentPhrase
    				});
    			}
    		}
    	};

    	return [
    		currentPhrase,
    		status,
    		isLearning,
    		canStart,
    		showCategory,
    		showFeedback,
    		heardPronunciation,
    		shouldShowExpectedOutput,
    		shouldShowAudioHint,
    		handleStartStop,
    		showExpectedOutput,
    		enableAudioHints,
    		log
    	];
    }

    class LearningSession extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			currentPhrase: 0,
    			status: 1,
    			isLearning: 2,
    			canStart: 3,
    			showCategory: 4,
    			showFeedback: 5,
    			showExpectedOutput: 10,
    			enableAudioHints: 11,
    			heardPronunciation: 6,
    			log: 12
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LearningSession",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get currentPhrase() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set currentPhrase(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get status() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set status(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isLearning() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isLearning(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get canStart() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set canStart(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showCategory() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showCategory(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showFeedback() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showFeedback(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showExpectedOutput() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showExpectedOutput(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get enableAudioHints() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set enableAudioHints(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get heardPronunciation() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set heardPronunciation(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get log() {
    		throw new Error("<LearningSession>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set log(value) {
    		throw new Error("<LearningSession>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/QueueDisplay.svelte generated by Svelte v3.59.2 */

    const file$1 = "src/QueueDisplay.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (7:0) {#if showUpcomingQueue && upcomingQueue.length > 0}
    function create_if_block$1(ctx) {
    	let div1;
    	let h3;
    	let t0;
    	let t1_value = /*upcomingQueue*/ ctx[1].length + "";
    	let t1;
    	let t2;
    	let t3;
    	let div0;
    	let each_value = /*upcomingQueue*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h3 = element("h3");
    			t0 = text("Complete Learning Queue (");
    			t1 = text(t1_value);
    			t2 = text(" items)");
    			t3 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h3, "class", "queue-title");
    			add_location(h3, file$1, 8, 4, 195);
    			attr_dev(div0, "class", "queue-list");
    			add_location(div0, file$1, 9, 4, 283);
    			attr_dev(div1, "class", "queue-section");
    			add_location(div1, file$1, 7, 2, 163);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h3);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(div1, t3);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div0, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcomingQueue*/ 2 && t1_value !== (t1_value = /*upcomingQueue*/ ctx[1].length + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*upcomingQueue*/ 2) {
    				each_value = /*upcomingQueue*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(7:0) {#if showUpcomingQueue && upcomingQueue.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (11:6) {#each upcomingQueue as item}
    function create_each_block(ctx) {
    	let div;
    	let span0;
    	let t0;
    	let t1_value = /*item*/ ctx[2].position + "";
    	let t1;
    	let t2;
    	let span1;
    	let t3_value = /*item*/ ctx[2].source + "";
    	let t3;
    	let t4;
    	let span2;
    	let t5_value = /*item*/ ctx[2].category + "";
    	let t5;
    	let t6;
    	let span3;

    	let t7_value = (/*item*/ ctx[2].recentResults.length === 0
    	? 'New'
    	: `${(/*item*/ ctx[2].successRate * 100).toFixed(0)}%`) + "";

    	let t7;
    	let t8;
    	let span4;
    	let t9_value = /*item*/ ctx[2].recentResults.filter(func).length + "";
    	let t9;
    	let t10;
    	let t11_value = /*item*/ ctx[2].recentResults.length + "";
    	let t11;
    	let t12;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text("#");
    			t1 = text(t1_value);
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			span2 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			span3 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			span4 = element("span");
    			t9 = text(t9_value);
    			t10 = text("/");
    			t11 = text(t11_value);
    			t12 = space();
    			attr_dev(span0, "class", "queue-position");
    			add_location(span0, file$1, 12, 10, 423);
    			attr_dev(span1, "class", "queue-text");
    			add_location(span1, file$1, 13, 10, 486);
    			attr_dev(span2, "class", "queue-category");
    			add_location(span2, file$1, 14, 10, 542);
    			attr_dev(span3, "class", "queue-success-rate");
    			toggle_class(span3, "struggling", /*item*/ ctx[2].successRate < 0.3);
    			toggle_class(span3, "mastered", /*item*/ ctx[2].successRate > 0.7);
    			add_location(span3, file$1, 15, 10, 604);
    			attr_dev(span4, "class", "queue-success-count");
    			add_location(span4, file$1, 18, 10, 846);
    			attr_dev(div, "class", "queue-item");
    			toggle_class(div, "current", /*item*/ ctx[2].position === 1);
    			add_location(div, file$1, 11, 8, 352);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(div, t2);
    			append_dev(div, span1);
    			append_dev(span1, t3);
    			append_dev(div, t4);
    			append_dev(div, span2);
    			append_dev(span2, t5);
    			append_dev(div, t6);
    			append_dev(div, span3);
    			append_dev(span3, t7);
    			append_dev(div, t8);
    			append_dev(div, span4);
    			append_dev(span4, t9);
    			append_dev(span4, t10);
    			append_dev(span4, t11);
    			append_dev(div, t12);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*upcomingQueue*/ 2 && t1_value !== (t1_value = /*item*/ ctx[2].position + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*upcomingQueue*/ 2 && t3_value !== (t3_value = /*item*/ ctx[2].source + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*upcomingQueue*/ 2 && t5_value !== (t5_value = /*item*/ ctx[2].category + "")) set_data_dev(t5, t5_value);

    			if (dirty & /*upcomingQueue*/ 2 && t7_value !== (t7_value = (/*item*/ ctx[2].recentResults.length === 0
    			? 'New'
    			: `${(/*item*/ ctx[2].successRate * 100).toFixed(0)}%`) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*upcomingQueue*/ 2) {
    				toggle_class(span3, "struggling", /*item*/ ctx[2].successRate < 0.3);
    			}

    			if (dirty & /*upcomingQueue*/ 2) {
    				toggle_class(span3, "mastered", /*item*/ ctx[2].successRate > 0.7);
    			}

    			if (dirty & /*upcomingQueue*/ 2 && t9_value !== (t9_value = /*item*/ ctx[2].recentResults.filter(func).length + "")) set_data_dev(t9, t9_value);
    			if (dirty & /*upcomingQueue*/ 2 && t11_value !== (t11_value = /*item*/ ctx[2].recentResults.length + "")) set_data_dev(t11, t11_value);

    			if (dirty & /*upcomingQueue*/ 2) {
    				toggle_class(div, "current", /*item*/ ctx[2].position === 1);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(11:6) {#each upcomingQueue as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*showUpcomingQueue*/ ctx[0] && /*upcomingQueue*/ ctx[1].length > 0 && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showUpcomingQueue*/ ctx[0] && /*upcomingQueue*/ ctx[1].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = r => r;

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('QueueDisplay', slots, []);
    	let { showUpcomingQueue } = $$props;
    	let { upcomingQueue } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (showUpcomingQueue === undefined && !('showUpcomingQueue' in $$props || $$self.$$.bound[$$self.$$.props['showUpcomingQueue']])) {
    			console.warn("<QueueDisplay> was created without expected prop 'showUpcomingQueue'");
    		}

    		if (upcomingQueue === undefined && !('upcomingQueue' in $$props || $$self.$$.bound[$$self.$$.props['upcomingQueue']])) {
    			console.warn("<QueueDisplay> was created without expected prop 'upcomingQueue'");
    		}
    	});

    	const writable_props = ['showUpcomingQueue', 'upcomingQueue'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<QueueDisplay> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('showUpcomingQueue' in $$props) $$invalidate(0, showUpcomingQueue = $$props.showUpcomingQueue);
    		if ('upcomingQueue' in $$props) $$invalidate(1, upcomingQueue = $$props.upcomingQueue);
    	};

    	$$self.$capture_state = () => ({ showUpcomingQueue, upcomingQueue });

    	$$self.$inject_state = $$props => {
    		if ('showUpcomingQueue' in $$props) $$invalidate(0, showUpcomingQueue = $$props.showUpcomingQueue);
    		if ('upcomingQueue' in $$props) $$invalidate(1, upcomingQueue = $$props.upcomingQueue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [showUpcomingQueue, upcomingQueue];
    }

    class QueueDisplay extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { showUpcomingQueue: 0, upcomingQueue: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "QueueDisplay",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get showUpcomingQueue() {
    		throw new Error("<QueueDisplay>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showUpcomingQueue(value) {
    		throw new Error("<QueueDisplay>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get upcomingQueue() {
    		throw new Error("<QueueDisplay>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set upcomingQueue(value) {
    		throw new Error("<QueueDisplay>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    // (453:4) {#if showSettings}
    function create_if_block(ctx) {
    	let div2;
    	let languagesettings;
    	let t0;
    	let displaysettings;
    	let updating_showExpectedOutput;
    	let updating_showCategory;
    	let updating_showFeedback;
    	let updating_showUpcomingQueue;
    	let updating_enableAudioHints;
    	let updating_translationThreshold;
    	let updating_pauseBetweenTests;
    	let updating_pauseWhenStruggling;
    	let t1;
    	let algorithmsettings;
    	let updating_passThreshold;
    	let updating_repetitivenessFactor;
    	let t2;
    	let categorymanager;
    	let updating_enabledCategories;
    	let t3;
    	let div1;
    	let h3;
    	let t5;
    	let div0;
    	let button;
    	let t6;
    	let button_disabled_value;
    	let t7;
    	let developersettings;
    	let updating_loggingVerbosity;
    	let current;
    	let mounted;
    	let dispose;

    	languagesettings = new LanguageSettings({
    			props: {
    				nativeLanguage: /*currentSettings*/ ctx[2].nativeLanguage,
    				learningLanguage: /*currentSettings*/ ctx[2].learningLanguage,
    				nativeLanguages: /*nativeLanguages*/ ctx[11],
    				learningLanguages: /*learningLanguages*/ ctx[10],
    				loggingVerbosity: /*currentSettings*/ ctx[2].loggingVerbosity
    			},
    			$$inline: true
    		});

    	function displaysettings_showExpectedOutput_binding(value) {
    		/*displaysettings_showExpectedOutput_binding*/ ctx[22](value);
    	}

    	function displaysettings_showCategory_binding(value) {
    		/*displaysettings_showCategory_binding*/ ctx[23](value);
    	}

    	function displaysettings_showFeedback_binding(value) {
    		/*displaysettings_showFeedback_binding*/ ctx[24](value);
    	}

    	function displaysettings_showUpcomingQueue_binding(value) {
    		/*displaysettings_showUpcomingQueue_binding*/ ctx[25](value);
    	}

    	function displaysettings_enableAudioHints_binding(value) {
    		/*displaysettings_enableAudioHints_binding*/ ctx[26](value);
    	}

    	function displaysettings_translationThreshold_binding(value) {
    		/*displaysettings_translationThreshold_binding*/ ctx[27](value);
    	}

    	function displaysettings_pauseBetweenTests_binding(value) {
    		/*displaysettings_pauseBetweenTests_binding*/ ctx[28](value);
    	}

    	function displaysettings_pauseWhenStruggling_binding(value) {
    		/*displaysettings_pauseWhenStruggling_binding*/ ctx[29](value);
    	}

    	let displaysettings_props = {};

    	if (/*currentSettings*/ ctx[2].showExpectedOutput !== void 0) {
    		displaysettings_props.showExpectedOutput = /*currentSettings*/ ctx[2].showExpectedOutput;
    	}

    	if (/*currentSettings*/ ctx[2].showCategory !== void 0) {
    		displaysettings_props.showCategory = /*currentSettings*/ ctx[2].showCategory;
    	}

    	if (/*currentSettings*/ ctx[2].showFeedback !== void 0) {
    		displaysettings_props.showFeedback = /*currentSettings*/ ctx[2].showFeedback;
    	}

    	if (/*currentSettings*/ ctx[2].showUpcomingQueue !== void 0) {
    		displaysettings_props.showUpcomingQueue = /*currentSettings*/ ctx[2].showUpcomingQueue;
    	}

    	if (/*currentSettings*/ ctx[2].enableAudioHints !== void 0) {
    		displaysettings_props.enableAudioHints = /*currentSettings*/ ctx[2].enableAudioHints;
    	}

    	if (/*currentSettings*/ ctx[2].translationThreshold !== void 0) {
    		displaysettings_props.translationThreshold = /*currentSettings*/ ctx[2].translationThreshold;
    	}

    	if (/*currentSettings*/ ctx[2].pauseBetweenTests !== void 0) {
    		displaysettings_props.pauseBetweenTests = /*currentSettings*/ ctx[2].pauseBetweenTests;
    	}

    	if (/*currentSettings*/ ctx[2].pauseWhenStruggling !== void 0) {
    		displaysettings_props.pauseWhenStruggling = /*currentSettings*/ ctx[2].pauseWhenStruggling;
    	}

    	displaysettings = new DisplaySettings({
    			props: displaysettings_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(displaysettings, 'showExpectedOutput', displaysettings_showExpectedOutput_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'showCategory', displaysettings_showCategory_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'showFeedback', displaysettings_showFeedback_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'showUpcomingQueue', displaysettings_showUpcomingQueue_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'enableAudioHints', displaysettings_enableAudioHints_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'translationThreshold', displaysettings_translationThreshold_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'pauseBetweenTests', displaysettings_pauseBetweenTests_binding));
    	binding_callbacks.push(() => bind(displaysettings, 'pauseWhenStruggling', displaysettings_pauseWhenStruggling_binding));
    	displaysettings.$on("updateQueue", /*updateUpcomingQueue*/ ctx[15]);

    	function algorithmsettings_passThreshold_binding(value) {
    		/*algorithmsettings_passThreshold_binding*/ ctx[30](value);
    	}

    	function algorithmsettings_repetitivenessFactor_binding(value) {
    		/*algorithmsettings_repetitivenessFactor_binding*/ ctx[31](value);
    	}

    	let algorithmsettings_props = {};

    	if (/*currentSettings*/ ctx[2].passThreshold !== void 0) {
    		algorithmsettings_props.passThreshold = /*currentSettings*/ ctx[2].passThreshold;
    	}

    	if (/*currentSettings*/ ctx[2].repetitivenessFactor !== void 0) {
    		algorithmsettings_props.repetitivenessFactor = /*currentSettings*/ ctx[2].repetitivenessFactor;
    	}

    	algorithmsettings = new AlgorithmSettings({
    			props: algorithmsettings_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(algorithmsettings, 'passThreshold', algorithmsettings_passThreshold_binding));
    	binding_callbacks.push(() => bind(algorithmsettings, 'repetitivenessFactor', algorithmsettings_repetitivenessFactor_binding));

    	function categorymanager_enabledCategories_binding(value) {
    		/*categorymanager_enabledCategories_binding*/ ctx[32](value);
    	}

    	let categorymanager_props = {
    		categories: /*categories*/ ctx[1],
    		loggingVerbosity: /*currentSettings*/ ctx[2].loggingVerbosity
    	};

    	if (/*currentSettings*/ ctx[2].enabledCategories !== void 0) {
    		categorymanager_props.enabledCategories = /*currentSettings*/ ctx[2].enabledCategories;
    	}

    	categorymanager = new CategoryManager({
    			props: categorymanager_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(categorymanager, 'enabledCategories', categorymanager_enabledCategories_binding));
    	categorymanager.$on("categoryChange", /*handleCategoryChange*/ ctx[13]);

    	function developersettings_loggingVerbosity_binding(value) {
    		/*developersettings_loggingVerbosity_binding*/ ctx[33](value);
    	}

    	let developersettings_props = {
    		showDeveloperSettings: /*currentSettings*/ ctx[2].showDeveloperSettings
    	};

    	if (/*currentSettings*/ ctx[2].loggingVerbosity !== void 0) {
    		developersettings_props.loggingVerbosity = /*currentSettings*/ ctx[2].loggingVerbosity;
    	}

    	developersettings = new DeveloperSettings({
    			props: developersettings_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(developersettings, 'loggingVerbosity', developersettings_loggingVerbosity_binding));
    	developersettings.$on("debugTest", /*handleDebugTest*/ ctx[14]);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			create_component(languagesettings.$$.fragment);
    			t0 = space();
    			create_component(displaysettings.$$.fragment);
    			t1 = space();
    			create_component(algorithmsettings.$$.fragment);
    			t2 = space();
    			create_component(categorymanager.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Management";
    			t5 = space();
    			div0 = element("div");
    			button = element("button");
    			t6 = text("🔄 Reset Learning Queue");
    			t7 = space();
    			create_component(developersettings.$$.fragment);
    			attr_dev(h3, "class", "section-header");
    			add_location(h3, file, 492, 10, 16406);
    			attr_dev(button, "class", "management-btn reset-btn");
    			button.disabled = button_disabled_value = !/*learningQueue*/ ctx[0];
    			add_location(button, file, 494, 0, 16492);
    			attr_dev(div0, "class", "management-buttons");
    			add_location(div0, file, 493, 10, 16459);
    			attr_dev(div1, "class", "management-section");
    			add_location(div1, file, 491, 8, 16363);
    			attr_dev(div2, "class", "settings-panel");
    			add_location(div2, file, 453, 6, 14828);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			mount_component(languagesettings, div2, null);
    			append_dev(div2, t0);
    			mount_component(displaysettings, div2, null);
    			append_dev(div2, t1);
    			mount_component(algorithmsettings, div2, null);
    			append_dev(div2, t2);
    			mount_component(categorymanager, div2, null);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, h3);
    			append_dev(div1, t5);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(button, t6);
    			append_dev(div2, t7);
    			mount_component(developersettings, div2, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*resetLearningQueue*/ ctx[21], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const languagesettings_changes = {};
    			if (dirty[0] & /*currentSettings*/ 4) languagesettings_changes.nativeLanguage = /*currentSettings*/ ctx[2].nativeLanguage;
    			if (dirty[0] & /*currentSettings*/ 4) languagesettings_changes.learningLanguage = /*currentSettings*/ ctx[2].learningLanguage;
    			if (dirty[0] & /*learningLanguages*/ 1024) languagesettings_changes.learningLanguages = /*learningLanguages*/ ctx[10];
    			if (dirty[0] & /*currentSettings*/ 4) languagesettings_changes.loggingVerbosity = /*currentSettings*/ ctx[2].loggingVerbosity;
    			languagesettings.$set(languagesettings_changes);
    			const displaysettings_changes = {};

    			if (!updating_showExpectedOutput && dirty[0] & /*currentSettings*/ 4) {
    				updating_showExpectedOutput = true;
    				displaysettings_changes.showExpectedOutput = /*currentSettings*/ ctx[2].showExpectedOutput;
    				add_flush_callback(() => updating_showExpectedOutput = false);
    			}

    			if (!updating_showCategory && dirty[0] & /*currentSettings*/ 4) {
    				updating_showCategory = true;
    				displaysettings_changes.showCategory = /*currentSettings*/ ctx[2].showCategory;
    				add_flush_callback(() => updating_showCategory = false);
    			}

    			if (!updating_showFeedback && dirty[0] & /*currentSettings*/ 4) {
    				updating_showFeedback = true;
    				displaysettings_changes.showFeedback = /*currentSettings*/ ctx[2].showFeedback;
    				add_flush_callback(() => updating_showFeedback = false);
    			}

    			if (!updating_showUpcomingQueue && dirty[0] & /*currentSettings*/ 4) {
    				updating_showUpcomingQueue = true;
    				displaysettings_changes.showUpcomingQueue = /*currentSettings*/ ctx[2].showUpcomingQueue;
    				add_flush_callback(() => updating_showUpcomingQueue = false);
    			}

    			if (!updating_enableAudioHints && dirty[0] & /*currentSettings*/ 4) {
    				updating_enableAudioHints = true;
    				displaysettings_changes.enableAudioHints = /*currentSettings*/ ctx[2].enableAudioHints;
    				add_flush_callback(() => updating_enableAudioHints = false);
    			}

    			if (!updating_translationThreshold && dirty[0] & /*currentSettings*/ 4) {
    				updating_translationThreshold = true;
    				displaysettings_changes.translationThreshold = /*currentSettings*/ ctx[2].translationThreshold;
    				add_flush_callback(() => updating_translationThreshold = false);
    			}

    			if (!updating_pauseBetweenTests && dirty[0] & /*currentSettings*/ 4) {
    				updating_pauseBetweenTests = true;
    				displaysettings_changes.pauseBetweenTests = /*currentSettings*/ ctx[2].pauseBetweenTests;
    				add_flush_callback(() => updating_pauseBetweenTests = false);
    			}

    			if (!updating_pauseWhenStruggling && dirty[0] & /*currentSettings*/ 4) {
    				updating_pauseWhenStruggling = true;
    				displaysettings_changes.pauseWhenStruggling = /*currentSettings*/ ctx[2].pauseWhenStruggling;
    				add_flush_callback(() => updating_pauseWhenStruggling = false);
    			}

    			displaysettings.$set(displaysettings_changes);
    			const algorithmsettings_changes = {};

    			if (!updating_passThreshold && dirty[0] & /*currentSettings*/ 4) {
    				updating_passThreshold = true;
    				algorithmsettings_changes.passThreshold = /*currentSettings*/ ctx[2].passThreshold;
    				add_flush_callback(() => updating_passThreshold = false);
    			}

    			if (!updating_repetitivenessFactor && dirty[0] & /*currentSettings*/ 4) {
    				updating_repetitivenessFactor = true;
    				algorithmsettings_changes.repetitivenessFactor = /*currentSettings*/ ctx[2].repetitivenessFactor;
    				add_flush_callback(() => updating_repetitivenessFactor = false);
    			}

    			algorithmsettings.$set(algorithmsettings_changes);
    			const categorymanager_changes = {};
    			if (dirty[0] & /*categories*/ 2) categorymanager_changes.categories = /*categories*/ ctx[1];
    			if (dirty[0] & /*currentSettings*/ 4) categorymanager_changes.loggingVerbosity = /*currentSettings*/ ctx[2].loggingVerbosity;

    			if (!updating_enabledCategories && dirty[0] & /*currentSettings*/ 4) {
    				updating_enabledCategories = true;
    				categorymanager_changes.enabledCategories = /*currentSettings*/ ctx[2].enabledCategories;
    				add_flush_callback(() => updating_enabledCategories = false);
    			}

    			categorymanager.$set(categorymanager_changes);

    			if (!current || dirty[0] & /*learningQueue*/ 1 && button_disabled_value !== (button_disabled_value = !/*learningQueue*/ ctx[0])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			const developersettings_changes = {};
    			if (dirty[0] & /*currentSettings*/ 4) developersettings_changes.showDeveloperSettings = /*currentSettings*/ ctx[2].showDeveloperSettings;

    			if (!updating_loggingVerbosity && dirty[0] & /*currentSettings*/ 4) {
    				updating_loggingVerbosity = true;
    				developersettings_changes.loggingVerbosity = /*currentSettings*/ ctx[2].loggingVerbosity;
    				add_flush_callback(() => updating_loggingVerbosity = false);
    			}

    			developersettings.$set(developersettings_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(languagesettings.$$.fragment, local);
    			transition_in(displaysettings.$$.fragment, local);
    			transition_in(algorithmsettings.$$.fragment, local);
    			transition_in(categorymanager.$$.fragment, local);
    			transition_in(developersettings.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(languagesettings.$$.fragment, local);
    			transition_out(displaysettings.$$.fragment, local);
    			transition_out(algorithmsettings.$$.fragment, local);
    			transition_out(categorymanager.$$.fragment, local);
    			transition_out(developersettings.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(languagesettings);
    			destroy_component(displaysettings);
    			destroy_component(algorithmsettings);
    			destroy_component(categorymanager);
    			destroy_component(developersettings);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(453:4) {#if showSettings}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div0;
    	let h1;
    	let t1;
    	let p;
    	let t3;
    	let learningsession;
    	let t4;
    	let div1;
    	let button;
    	let span0;
    	let t6;
    	let span1;
    	let t7_value = (/*showSettings*/ ctx[3] ? '⬆️' : '⬇️') + "";
    	let t7;
    	let button_title_value;
    	let t8;
    	let t9;
    	let queuedisplay;
    	let current;
    	let mounted;
    	let dispose;

    	learningsession = new LearningSession({
    			props: {
    				currentPhrase: /*currentPhrase*/ ctx[5],
    				status: /*status*/ ctx[6],
    				isLearning: /*isLearning*/ ctx[4],
    				canStart: /*canStart*/ ctx[9],
    				showCategory: /*currentSettings*/ ctx[2].showCategory,
    				showFeedback: /*currentSettings*/ ctx[2].showFeedback,
    				showExpectedOutput: /*currentSettings*/ ctx[2].showExpectedOutput,
    				enableAudioHints: /*currentSettings*/ ctx[2].enableAudioHints,
    				heardPronunciation: /*heardPronunciation*/ ctx[8],
    				log: /*log*/ ctx[12]
    			},
    			$$inline: true
    		});

    	learningsession.$on("startStop", /*handleStartStop*/ ctx[16]);
    	let if_block = /*showSettings*/ ctx[3] && create_if_block(ctx);

    	queuedisplay = new QueueDisplay({
    			props: {
    				showUpcomingQueue: /*currentSettings*/ ctx[2].showUpcomingQueue,
    				upcomingQueue: /*upcomingQueue*/ ctx[7]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Language Tutor";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Your personal AI language learning companion";
    			t3 = space();
    			create_component(learningsession.$$.fragment);
    			t4 = space();
    			div1 = element("div");
    			button = element("button");
    			span0 = element("span");
    			span0.textContent = "⚙️";
    			t6 = text("\n      Settings\n      ");
    			span1 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			if (if_block) if_block.c();
    			t9 = space();
    			create_component(queuedisplay.$$.fragment);
    			add_location(h1, file, 416, 4, 13585);
    			add_location(p, file, 417, 4, 13613);
    			attr_dev(div0, "class", "title");
    			add_location(div0, file, 415, 2, 13561);
    			attr_dev(span0, "class", "settings-icon svelte-15o4qf2");
    			toggle_class(span0, "developer-mode", /*currentSettings*/ ctx[2].showDeveloperSettings);
    			add_location(span0, file, 447, 6, 14601);
    			attr_dev(span1, "class", "chevron-icon");
    			add_location(span1, file, 449, 6, 14721);
    			attr_dev(button, "class", "settings-toggle");

    			attr_dev(button, "title", button_title_value = /*currentSettings*/ ctx[2].showDeveloperSettings
    			? "Developer mode active! Long press again to disable."
    			: "Long press for developer settings");

    			add_location(button, file, 437, 4, 14150);
    			attr_dev(div1, "class", "settings-section");
    			add_location(div1, file, 436, 2, 14115);
    			attr_dev(main, "class", "app-container");
    			add_location(main, file, 413, 0, 13513);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, p);
    			append_dev(main, t3);
    			mount_component(learningsession, main, null);
    			append_dev(main, t4);
    			append_dev(main, div1);
    			append_dev(div1, button);
    			append_dev(button, span0);
    			append_dev(button, t6);
    			append_dev(button, span1);
    			append_dev(span1, t7);
    			append_dev(div1, t8);
    			if (if_block) if_block.m(div1, null);
    			append_dev(main, t9);
    			mount_component(queuedisplay, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*toggleSettings*/ ctx[17], false, false, false, false),
    					listen_dev(button, "mousedown", /*handleSettingsMouseDown*/ ctx[18], false, false, false, false),
    					listen_dev(button, "mouseup", /*handleSettingsMouseUp*/ ctx[19], false, false, false, false),
    					listen_dev(button, "mouseleave", /*handleSettingsMouseLeave*/ ctx[20], false, false, false, false),
    					listen_dev(button, "touchstart", /*handleSettingsMouseDown*/ ctx[18], { passive: true }, false, false, false),
    					listen_dev(button, "touchend", /*handleSettingsMouseUp*/ ctx[19], { passive: true }, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const learningsession_changes = {};
    			if (dirty[0] & /*currentPhrase*/ 32) learningsession_changes.currentPhrase = /*currentPhrase*/ ctx[5];
    			if (dirty[0] & /*status*/ 64) learningsession_changes.status = /*status*/ ctx[6];
    			if (dirty[0] & /*isLearning*/ 16) learningsession_changes.isLearning = /*isLearning*/ ctx[4];
    			if (dirty[0] & /*canStart*/ 512) learningsession_changes.canStart = /*canStart*/ ctx[9];
    			if (dirty[0] & /*currentSettings*/ 4) learningsession_changes.showCategory = /*currentSettings*/ ctx[2].showCategory;
    			if (dirty[0] & /*currentSettings*/ 4) learningsession_changes.showFeedback = /*currentSettings*/ ctx[2].showFeedback;
    			if (dirty[0] & /*currentSettings*/ 4) learningsession_changes.showExpectedOutput = /*currentSettings*/ ctx[2].showExpectedOutput;
    			if (dirty[0] & /*currentSettings*/ 4) learningsession_changes.enableAudioHints = /*currentSettings*/ ctx[2].enableAudioHints;
    			if (dirty[0] & /*heardPronunciation*/ 256) learningsession_changes.heardPronunciation = /*heardPronunciation*/ ctx[8];
    			learningsession.$set(learningsession_changes);

    			if (!current || dirty[0] & /*currentSettings*/ 4) {
    				toggle_class(span0, "developer-mode", /*currentSettings*/ ctx[2].showDeveloperSettings);
    			}

    			if ((!current || dirty[0] & /*showSettings*/ 8) && t7_value !== (t7_value = (/*showSettings*/ ctx[3] ? '⬆️' : '⬇️') + "")) set_data_dev(t7, t7_value);

    			if (!current || dirty[0] & /*currentSettings*/ 4 && button_title_value !== (button_title_value = /*currentSettings*/ ctx[2].showDeveloperSettings
    			? "Developer mode active! Long press again to disable."
    			: "Long press for developer settings")) {
    				attr_dev(button, "title", button_title_value);
    			}

    			if (/*showSettings*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*showSettings*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const queuedisplay_changes = {};
    			if (dirty[0] & /*currentSettings*/ 4) queuedisplay_changes.showUpcomingQueue = /*currentSettings*/ ctx[2].showUpcomingQueue;
    			if (dirty[0] & /*upcomingQueue*/ 128) queuedisplay_changes.upcomingQueue = /*upcomingQueue*/ ctx[7];
    			queuedisplay.$set(queuedisplay_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(learningsession.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(queuedisplay.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(learningsession.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(queuedisplay.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(learningsession);
    			if (if_block) if_block.d();
    			destroy_component(queuedisplay);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let learningLanguages;
    	let canStart;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let showSettings = false;
    	let isLearning = false;
    	let currentPhrase = null;
    	let status = "Ready to start learning!";
    	let learningQueue = null;
    	let tutor = null;
    	let categories = [];
    	let upcomingQueue = [];
    	let isInitialized = false;
    	let heardPronunciation = '';

    	// Settings from store
    	let currentSettings = {};

    	// Subscribe to settings store
    	let previousNativeLanguage = '';

    	let previousLearningLanguage = '';

    	settings.subscribe(value => {
    		const oldSettings = currentSettings;
    		$$invalidate(2, currentSettings = value);

    		// Update systems only when language settings change (not other settings)
    		if (isInitialized && (oldSettings.nativeLanguage !== value.nativeLanguage || oldSettings.learningLanguage !== value.learningLanguage)) {
    			updateSystems();
    		}
    	});

    	const languageOptions = { 'English': ['Italian', 'Spanish'] }; // Future: 'Spanish': ['English'], 'French': ['English', 'German'], etc.

    	// Derive arrays from the hash
    	const nativeLanguages = Object.keys(languageOptions);

    	// ========== LOGGING SYSTEM ==========
    	function log(level, ...args) {
    		if (currentSettings.loggingVerbosity >= level) {
    			console.log(...args);
    		}
    	}

    	function logError(level, ...args) {
    		if (currentSettings.loggingVerbosity >= level) {
    			console.error(...args);
    		}
    	}

    	function logWarn(level, ...args) {
    		if (currentSettings.loggingVerbosity >= level) {
    			console.warn(...args);
    		}
    	}

    	// ========== LIFECYCLE ==========
    	onMount(async () => {
    		log(4, '🚀 App mounted, loading settings...');

    		// Load settings from localStorage
    		settings.load();

    		// Wait a tick for settings to propagate
    		await new Promise(resolve => setTimeout(resolve, 0));

    		// Initialize systems
    		await initializeSystems();

    		isInitialized = true;
    		log(4, '🎉 App initialization complete');
    	});

    	// Clean up when component is destroyed
    	onDestroy(() => {
    		log(4, '🧹 App being destroyed, cleaning up...');

    		// Stop any active learning session to release microphone
    		if (isLearning) {
    			stopLearningSession();
    		}

    		// Clean up tutor and queue instances
    		if (tutor) {
    			tutor.destroy();
    		}
    	});

    	// ========== SYSTEM INITIALIZATION ==========
    	async function initializeSystems() {
    		await initializeLearningQueue();
    		initializeTutor();
    	}

    	async function updateSystems() {
    		// Reinitialize when core settings change
    		if (learningQueue || tutor) {
    			await initializeLearningQueue();
    			initializeTutor();
    		}
    	}

    	async function initializeLearningQueue() {
    		log(5, '🏗️ Initializing LearningQueue for:', currentSettings.nativeLanguage, '→', currentSettings.learningLanguage);
    		$$invalidate(1, categories = []);

    		$$invalidate(0, learningQueue = new LearningQueue(currentSettings.nativeLanguage,
    		currentSettings.learningLanguage,
    		'basic',
    		'learning/',
    		{
    				passThreshold: currentSettings.passThreshold,
    				memoryLength: 20,
    				repetitivenessFactor: currentSettings.repetitivenessFactor
    			},
    		log)); // Pass the log function to LearningQueue

    		await learningQueue.init();
    		const availableCategories = learningQueue.getCategories();
    		$$invalidate(1, categories = availableCategories);

    		// Restore or initialize category preferences
    		const newEnabledCategories = {};

    		availableCategories.forEach(category => {
    			newEnabledCategories[category] = currentSettings.enabledCategories[category] ?? true;
    			learningQueue.setCategory(category, newEnabledCategories[category]);
    		});

    		settings.updateSetting('enabledCategories', newEnabledCategories);
    		updateUpcomingQueue();
    		log(5, '✅ LearningQueue initialization complete');
    	}

    	function initializeTutor() {
    		tutor = new LanguageTutor(null,
    		currentSettings.nativeLanguage,
    		currentSettings.learningLanguage,
    		{
    				apiKeyEndpoint: 'openai.php',
    				feedbackThreshold: currentSettings.translationThreshold,
    				passThreshold: currentSettings.passThreshold,
    				audioPath: 'audio/',
    				enableAudioHints: currentSettings.enableAudioHints,
    				statusCallback: message => {
    					if (!currentSettings.showFeedback && isLearning) {
    						if (message.includes('Listen to this')) {
    							$$invalidate(6, status = `Listen to the ${currentSettings.nativeLanguage} phrase...`);
    						} else if (message.includes('Now say it in')) {
    							$$invalidate(6, status = `Now say it in ${currentSettings.learningLanguage}...`);
    						}
    					} else {
    						$$invalidate(6, status = message);
    					}
    				}
    			},
    		log); // Pass the log function to LanguageTutor
    	}

    	// ========== EVENT HANDLERS ==========
    	function handleCategoryChange(event) {
    		const { category, enabled } = event.detail;

    		// No need to update settings here - binding handles that automatically
    		// Just update the LearningQueue
    		if (learningQueue) {
    			learningQueue.setCategory(category, enabled);
    			updateUpcomingQueue();
    		}
    	}

    	function handleDebugTest(event) {
    		const { action } = event.detail;

    		if (!learningQueue) {
    			log(3, '❌ Debug test failed: no learning queue');
    			return;
    		}

    		const phrase = learningQueue.getNextTest();

    		if (!phrase) {
    			log(3, '❌ Debug test failed: no phrases available');
    			return;
    		}

    		// Simulate pass (score 10) or fail (score 0)
    		const score = action === 'pass' ? 10 : 0;

    		log(5, `🐛 Debug ${action}: "${phrase.source}" → "${phrase.target}" (score: ${score})`);

    		// Score the test directly through the learning queue
    		learningQueue.scoreCurrentTest(score);

    		updateUpcomingQueue();
    		$$invalidate(6, status = `Debug ${action}: "${phrase.source}" scored ${score}/10`);
    	}

    	function updateUpcomingQueue() {
    		if (learningQueue && currentSettings.showUpcomingQueue) {
    			$$invalidate(7, upcomingQueue = learningQueue.getTopQueueItems());
    			log(7, '📋 Updated upcoming queue:', upcomingQueue.length, 'items');
    		}
    	}

    	// ========== LEARNING SESSION ==========
    	async function startLearningSession() {
    		if (!learningQueue || !tutor) {
    			$$invalidate(6, status = "Blimey! Something's gone wrong with the initialisation.");
    			return;
    		}

    		try {
    			// Start persistent microphone session to avoid repeated connections
    			log(5, '🎓 Starting persistent microphone session for learning');

    			await tutor.startLearningSession();
    			$$invalidate(4, isLearning = true);
    			$$invalidate(6, status = "Right then, let's get cracking!");
    			await runLearningLoop();
    		} catch(error) {
    			log(2, '❌ Failed to start learning session:', error);
    			$$invalidate(6, status = "Couldn't access your microphone. Please check your permissions and try again.");
    			$$invalidate(4, isLearning = false);
    		}
    	}

    	async function runLearningLoop() {
    		while (isLearning) {
    			const phrase = learningQueue.getNextTest();

    			if (!phrase) {
    				$$invalidate(6, status = "No more phrases available! Check your category settings.");
    				stopLearningSession();
    				break;
    			}

    			log(8, '📋 Got phrase from queue:', phrase);
    			log(8, '📊 Phrase recentResults:', phrase.recentResults, 'length:', phrase.recentResults?.length);
    			$$invalidate(5, currentPhrase = phrase);
    			$$invalidate(8, heardPronunciation = ''); // Clear previous heard pronunciation
    			$$invalidate(6, status = `Ready to listen to ${currentSettings.nativeLanguage} phrase...`);
    			if (!isLearning) break;

    			try {
    				const result = await tutor.test(phrase.source, phrase.target, phrase.pronunciation || '', phrase.recentResults || []);

    				// Capture heard pronunciation from result
    				$$invalidate(8, heardPronunciation = result.heardPronunciation || '');

    				if (result.stop || !isLearning) {
    					stopLearningSession();
    					break;
    				} else if (result.score === 0) {
    					$$invalidate(6, status = `No response detected - ${result.commentary}`);
    					log(6, `⏳ Pausing ${currentSettings.pauseBetweenTests} seconds before repeating phrase`);
    					await new Promise(resolve => setTimeout(resolve, currentSettings.pauseBetweenTests * 1000));
    				} else {
    					learningQueue.scoreCurrentTest(result.score);
    					updateUpcomingQueue();
    					$$invalidate(6, status = `Score: ${result.score}/10 - ${result.commentary}`);

    					// Use dynamic pause duration based on performance
    					const pauseDuration = getPauseDuration(phrase, result.score);

    					log(6, `⏳ Pausing ${pauseDuration} seconds before next phrase`);
    					await new Promise(resolve => setTimeout(resolve, pauseDuration * 1000));
    				}
    			} catch(error) {
    				$$invalidate(6, status = "Smeg! Something went wrong with the AI. Try again.");
    				stopLearningSession();
    				break;
    			}
    		}
    	}

    	function getPauseDuration(phrase, score) {
    		if (!phrase || !phrase.recentResults || phrase.recentResults.length === 0) {
    			return currentSettings.pauseBetweenTests;
    		}

    		const successCount = phrase.recentResults.filter(r => r === 1).length;
    		const successRate = successCount / phrase.recentResults.length;
    		const isStruggling = successRate < 0.25 || score < 4;

    		return isStruggling
    		? currentSettings.pauseWhenStruggling
    		: currentSettings.pauseBetweenTests;
    	}

    	function stopLearningSession() {
    		$$invalidate(4, isLearning = false);

    		// Stop persistent microphone session
    		if (tutor && tutor.isSessionActive()) {
    			log(5, '🎓 Stopping persistent microphone session');
    			tutor.stopLearningSession();
    		}

    		if (!status.includes('Score:') && !status.includes('commentary')) {
    			$$invalidate(6, status = "Learning session stopped. Ready when you are!");
    		}

    		$$invalidate(5, currentPhrase = null);
    	}

    	function handleStartStop() {
    		if (isLearning) {
    			stopLearningSession();
    		} else {
    			startLearningSession();
    		}
    	}

    	// ========== SETTINGS UI ==========
    	function toggleSettings() {
    		$$invalidate(3, showSettings = !showSettings);
    	}

    	// Easter egg: Long press on settings cog for developer settings
    	let settingsLongPressTimer = null;

    	function handleSettingsMouseDown() {
    		settingsLongPressTimer = setTimeout(
    			() => {
    				settings.updateSetting('showDeveloperSettings', !currentSettings.showDeveloperSettings);

    				log(3, '🥚 Developer settings easter egg triggered!', currentSettings.showDeveloperSettings
    				? 'Enabled'
    				: 'Disabled');

    				const settingsButton = document.querySelector('.settings-toggle');

    				if (settingsButton) {
    					settingsButton.style.transform = 'scale(0.95)';
    					setTimeout(() => settingsButton.style.transform = '', 150);
    				}
    			},
    			2000
    		);
    	}

    	function handleSettingsMouseUp() {
    		if (settingsLongPressTimer) {
    			clearTimeout(settingsLongPressTimer);
    			settingsLongPressTimer = null;
    		}
    	}

    	function handleSettingsMouseLeave() {
    		if (settingsLongPressTimer) {
    			clearTimeout(settingsLongPressTimer);
    			settingsLongPressTimer = null;
    		}
    	}

    	// ========== MANAGEMENT ACTIONS ==========
    	function resetLearningQueue() {
    		if (learningQueue && confirm('Are you sure you want to reset the learning queue? This will clear all progress and start fresh.')) {
    			learningQueue.reset();
    			const availableCategories = learningQueue.getCategories();
    			$$invalidate(1, categories = availableCategories);
    			const newEnabledCategories = {};

    			availableCategories.forEach(category => {
    				newEnabledCategories[category] = true;
    				learningQueue.setCategory(category, true);
    			});

    			settings.updateSetting('enabledCategories', newEnabledCategories);
    			updateUpcomingQueue();
    			$$invalidate(6, status = 'Learning queue reset successfully!');

    			setTimeout(
    				() => {
    					if (!isLearning) $$invalidate(6, status = "Ready to start learning!");
    				},
    				3000
    			);
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function displaysettings_showExpectedOutput_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.showExpectedOutput, value)) {
    			currentSettings.showExpectedOutput = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_showCategory_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.showCategory, value)) {
    			currentSettings.showCategory = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_showFeedback_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.showFeedback, value)) {
    			currentSettings.showFeedback = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_showUpcomingQueue_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.showUpcomingQueue, value)) {
    			currentSettings.showUpcomingQueue = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_enableAudioHints_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.enableAudioHints, value)) {
    			currentSettings.enableAudioHints = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_translationThreshold_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.translationThreshold, value)) {
    			currentSettings.translationThreshold = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_pauseBetweenTests_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.pauseBetweenTests, value)) {
    			currentSettings.pauseBetweenTests = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function displaysettings_pauseWhenStruggling_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.pauseWhenStruggling, value)) {
    			currentSettings.pauseWhenStruggling = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function algorithmsettings_passThreshold_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.passThreshold, value)) {
    			currentSettings.passThreshold = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function algorithmsettings_repetitivenessFactor_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.repetitivenessFactor, value)) {
    			currentSettings.repetitivenessFactor = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function categorymanager_enabledCategories_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.enabledCategories, value)) {
    			currentSettings.enabledCategories = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	function developersettings_loggingVerbosity_binding(value) {
    		if ($$self.$$.not_equal(currentSettings.loggingVerbosity, value)) {
    			currentSettings.loggingVerbosity = value;
    			$$invalidate(2, currentSettings);
    		}
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		LearningQueue,
    		LanguageTutor,
    		settings,
    		LanguageSettings,
    		DisplaySettings,
    		AlgorithmSettings,
    		CategoryManager,
    		DeveloperSettings,
    		LearningSession,
    		QueueDisplay,
    		showSettings,
    		isLearning,
    		currentPhrase,
    		status,
    		learningQueue,
    		tutor,
    		categories,
    		upcomingQueue,
    		isInitialized,
    		heardPronunciation,
    		currentSettings,
    		previousNativeLanguage,
    		previousLearningLanguage,
    		languageOptions,
    		nativeLanguages,
    		log,
    		logError,
    		logWarn,
    		initializeSystems,
    		updateSystems,
    		initializeLearningQueue,
    		initializeTutor,
    		handleCategoryChange,
    		handleDebugTest,
    		updateUpcomingQueue,
    		startLearningSession,
    		runLearningLoop,
    		getPauseDuration,
    		stopLearningSession,
    		handleStartStop,
    		toggleSettings,
    		settingsLongPressTimer,
    		handleSettingsMouseDown,
    		handleSettingsMouseUp,
    		handleSettingsMouseLeave,
    		resetLearningQueue,
    		canStart,
    		learningLanguages
    	});

    	$$self.$inject_state = $$props => {
    		if ('showSettings' in $$props) $$invalidate(3, showSettings = $$props.showSettings);
    		if ('isLearning' in $$props) $$invalidate(4, isLearning = $$props.isLearning);
    		if ('currentPhrase' in $$props) $$invalidate(5, currentPhrase = $$props.currentPhrase);
    		if ('status' in $$props) $$invalidate(6, status = $$props.status);
    		if ('learningQueue' in $$props) $$invalidate(0, learningQueue = $$props.learningQueue);
    		if ('tutor' in $$props) tutor = $$props.tutor;
    		if ('categories' in $$props) $$invalidate(1, categories = $$props.categories);
    		if ('upcomingQueue' in $$props) $$invalidate(7, upcomingQueue = $$props.upcomingQueue);
    		if ('isInitialized' in $$props) isInitialized = $$props.isInitialized;
    		if ('heardPronunciation' in $$props) $$invalidate(8, heardPronunciation = $$props.heardPronunciation);
    		if ('currentSettings' in $$props) $$invalidate(2, currentSettings = $$props.currentSettings);
    		if ('previousNativeLanguage' in $$props) previousNativeLanguage = $$props.previousNativeLanguage;
    		if ('previousLearningLanguage' in $$props) previousLearningLanguage = $$props.previousLearningLanguage;
    		if ('settingsLongPressTimer' in $$props) settingsLongPressTimer = $$props.settingsLongPressTimer;
    		if ('canStart' in $$props) $$invalidate(9, canStart = $$props.canStart);
    		if ('learningLanguages' in $$props) $$invalidate(10, learningLanguages = $$props.learningLanguages);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*currentSettings*/ 4) {
    			$$invalidate(10, learningLanguages = languageOptions[currentSettings.nativeLanguage] || []);
    		}

    		if ($$self.$$.dirty[0] & /*currentSettings, categories*/ 6) {
    			// Reactive computed values
    			$$invalidate(9, canStart = Object.values(currentSettings.enabledCategories).some(enabled => enabled) && categories.length > 0);
    		}

    		if ($$self.$$.dirty[0] & /*learningQueue, currentSettings*/ 5) {
    			// Reactive updates for tutor and queue options (but not during language changes)
    			// LanguageTutor now uses passed-in log function, no need to update loggingVerbosity
    			// LearningQueue now uses passed-in log function, no need to update loggingVerbosity
    			if (learningQueue && currentSettings.repetitivenessFactor !== undefined && learningQueue.options) {
    				learningQueue.updateOptions({
    					repetitivenessFactor: currentSettings.repetitivenessFactor
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*learningQueue, currentSettings*/ 5) {
    			if (learningQueue && currentSettings.passThreshold !== undefined && learningQueue.options) {
    				learningQueue.updateOptions({
    					passThreshold: currentSettings.passThreshold
    				});
    			}
    		}
    	};

    	return [
    		learningQueue,
    		categories,
    		currentSettings,
    		showSettings,
    		isLearning,
    		currentPhrase,
    		status,
    		upcomingQueue,
    		heardPronunciation,
    		canStart,
    		learningLanguages,
    		nativeLanguages,
    		log,
    		handleCategoryChange,
    		handleDebugTest,
    		updateUpcomingQueue,
    		handleStartStop,
    		toggleSettings,
    		handleSettingsMouseDown,
    		handleSettingsMouseUp,
    		handleSettingsMouseLeave,
    		resetLearningQueue,
    		displaysettings_showExpectedOutput_binding,
    		displaysettings_showCategory_binding,
    		displaysettings_showFeedback_binding,
    		displaysettings_showUpcomingQueue_binding,
    		displaysettings_enableAudioHints_binding,
    		displaysettings_translationThreshold_binding,
    		displaysettings_pauseBetweenTests_binding,
    		displaysettings_pauseWhenStruggling_binding,
    		algorithmsettings_passThreshold_binding,
    		algorithmsettings_repetitivenessFactor_binding,
    		categorymanager_enabledCategories_binding,
    		developersettings_loggingVerbosity_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
