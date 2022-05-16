/** Value used to represent epsilon */
export const EPSILON = null;

/**
 * An helper class to build non deterministic finite state automata with epsilon
 * transitions by composing automatas
 */
export class AutomataComposer {
  /** Id of the starting state */
  readonly start: number;
  /** Id of the ending state */
  readonly end: number;
  /** All transitions */
  readonly transitions: Transition[];

  /**
   * Build a new automata composer
   * @param start Starting state
   * @param end Ending state
   * @param transitions List of transitions
   */
  constructor(start: number, end: number, transitions: Transition[]) {
    this.start = start;
    this.end = end;
    this.transitions = transitions;
  }

  build(): Automata {
    return new UndeterministicAutomata(this).toDeterministic();
  }
}

/**
 * Build an automata with only one transition
 * @param symbol The symbol on the transition
 * @returns The automata
 */
export function unit(symbol: string): AutomataComposer {
  return new AutomataComposer(0, 1, [{ from: 0, to: 1, symbol: symbol }]);
}

/**
 * Build an automata that recognizes both the language in lhs and the language
 * in rhs
 * @param lhs The first language
 * @param rhs The second language
 * @returns An automata that recognizes both languages
 */
export function or(lhs: AutomataComposer, rhs: AutomataComposer): AutomataComposer {
  const remapper = new StateRemapper(2);
  const lhsOk = remapper.rewrite(lhs);
  const rhsOk = remapper.rewrite(rhs);
  return new AutomataComposer(
    0, 1, 
    [
      // either lhs
      { from: 0, symbol: EPSILON, to: lhsOk.start },
      ...lhsOk.transitions,
      { from: lhsOk.end, symbol: EPSILON, to: 1 },
      // or rhs
      { from: 0, symbol: EPSILON, to: rhsOk.start },
      ...rhsOk.transitions,
      { from: rhsOk.end, symbol: EPSILON, to: 1 },
    ]
  )
}

/**
 * Build an automata that recognizes the language described by the sequence
 * of given automatas
 * @param lhs The first part
 * @param rhs The second part
 * @returns lhs -eps-> rhs
 */
export function chain(...subAutomatas: AutomataComposer[]): AutomataComposer {
  if (subAutomatas.length === 0) {
    return new AutomataComposer(0, 0, []);
  }

  const remapper = new StateRemapper(0);
  const subOk = subAutomatas.map(sub => remapper.rewrite(sub));
  
  const junctions: Transition[] = [];
  for (let i = 0; i != subOk.length - 1; ++i) {
    junctions.push({ from: subOk[i].end, to: subOk[i + 1].start, symbol: EPSILON });
  }

  return new AutomataComposer(
    subOk[0].start, subOk[subOk.length - 1].end,
    [
      ...subOk.flatMap(sub => sub.transitions),
      ...junctions
    ]
  );
}

/** Builds the automata (self)? */
export function maybe(self: AutomataComposer): AutomataComposer {
  return bridge(self, { from: 0, to: 1, symbol: EPSILON });
}

/** Builds the automata (self)+ */
export function plus(self: AutomataComposer): AutomataComposer {
  return bridge(self, { from: 1, to: 0, symbol: EPSILON });
}

/** Builds the automata (self)* */
export function star(self: AutomataComposer): AutomataComposer {
  return maybe(plus(self));
}

function bridge(self: AutomataComposer, extra: Transition): AutomataComposer {
  const remapper = new StateRemapper(2);
  const selfOk = remapper.rewrite(self);

  return new AutomataComposer(0, 1, [
    ...selfOk.transitions,
    extra,
    { from: 0, to: selfOk.start, symbol: EPSILON },
    { from: selfOk.end, to: 1, symbol: EPSILON },
  ]);
}

/**
 * Build an automata where all symbols has been modified
 */
export function modifyTransitions(
  self: AutomataComposer, modifier: (symbol: string) => string
): AutomataComposer {
  return new AutomataComposer(
    self.start,
    self.end,
    self.transitions.map(transition => {
      if (transition.symbol === EPSILON) return transition;
      return {
        from: transition.from,
        to: transition.to,
        symbol: modifier(transition.symbol)
      }
    })
  );
}

function identity<T>(t: T) { return t; }

/**
 * Inverse the automata state
 * @param self The base automata
 * @param modifier A function to apply to the transition names. Default value
 * is the identity function (i.e. the transitions are not changed)
 * @returns An automata composer that is the inverse of the original one
 */
export function inverse(
  self: AutomataComposer,
  modifier: (symbol: string) => string = identity
): AutomataComposer {
  return new AutomataComposer(
    self.end,
    self.start,
    self.transitions.map(transition => {
      return {
        from: transition.to,
        to: transition.from,
        symbol: transition.symbol === EPSILON ? EPSILON : modifier(transition.symbol)
      }
    })
  );
}

/** A transition */
export type Transition = {
  /** Starting state id */
  readonly from: number;
  /** Symbol used to travel through the transition */
  readonly symbol: string | typeof EPSILON;
  /** Destination state id */
  readonly to: number;
};

/**
 * Class used to have distinct node ids when composing two distinct automatas
 */
class StateRemapper {
  private nextState: number;

  constructor(startFrom: number) {
    this.nextState = startFrom;
  }

  rewrite(automata: AutomataComposer): AutomataComposer {
    let oldToNew = new Map<number, number>();

    const get = (stateId: number) => {
      let r = oldToNew.get(stateId);
      if (r === undefined) {
        r = ++this.nextState;
        oldToNew.set(stateId, r);
      }
      return r;
    };

    const newStart = get(automata.start);
    const newEnd = get(automata.end);

    const transitions = automata.transitions.map(transition => ({
      from: get(transition.from),
      symbol: transition.symbol,
      to: get(transition.to)
    }));

    return new AutomataComposer(newStart, newEnd, transitions);
  }
}

/**
 * An automata with undeterministic transitions. Used as a stepping stone from
 * the automata composer representation with a list of transitions and a real
 * automata with a state centric representation.
 */
class UndeterministicAutomata {
  /** Starting state */
  readonly start: UndeterministicState;
  /** Accepting state */
  readonly end: UndeterministicState;
  /** Every known states */
  readonly allStates: Map<number, UndeterministicState>;

  /** Builds the undeterministic automata */
  constructor(composer: AutomataComposer) {
    this.allStates = new Map();

    const getState = (stateId: number): UndeterministicState => {
      let state = this.allStates.get(stateId);
  
      if (state === undefined) {
        state = new UndeterministicState(stateId);
        this.allStates.set(stateId, state);
      }
  
      return state;
    };

    this.start = getState(composer.start);
    this.end = getState(composer.end);

    for (const { from, to, symbol } of composer.transitions) {
      const begin = getState(from);
      const end = getState(to);

      if (symbol === EPSILON) {
        begin.addEpsilon(end);
      } else {
        begin.addTransition(symbol, end);
      }
    }
  }

  /**
   * Converts this automata into a deterministic finite state automata
   */
  toDeterministic(): Automata {
    let allStates = new Map<string, CompoundUndeterministicState>();
    let notVisited: CompoundUndeterministicState[] = [];
    
    const ends: CompoundUndeterministicState[] = [];

    /**
     * From a list of undeterminist state, returns a object that represents the
     * final deterministic state, ie a state that represents the union of all
     * passed states and the states that they can reach through an epsilon
     * transition.
     */
    const getState = (states: UndeterministicState[]): CompoundUndeterministicState => {
      const stateClosure = CompoundUndeterministicState.computeClosure(states);
      const key = CompoundUndeterministicState.makeKey(stateClosure);
      let compoundState = allStates.get(key);
      
      if (compoundState !== undefined) {
        return compoundState;
      }

      compoundState = new CompoundUndeterministicState(allStates.size, stateClosure);

      if (stateClosure.includes(this.end)) {
        ends.push(compoundState);
      }

      allStates.set(key, compoundState);
      notVisited.push(compoundState);

      return compoundState;
    };

    const start = getState([this.start]);

    while (true) {
      const compoundState = notVisited.shift();
      if (compoundState === undefined) break;

      let transitions = new Map<string, UndeterministicState[]>();

      for (const state of compoundState.states) {
        for (const [transition, nextStates] of state.transitions) {
          let r = transitions.get(transition);
          if (r === undefined) {
            r = [];
            transitions.set(transition, r);
          }

          nextStates.forEach(nextState => UndeterministicState.ensureHas(r!, nextState));
        }
      }

      for (const [symbol, stateCollection] of transitions) {
        const endOfTransition = getState(stateCollection);

        compoundState.uniqueState.transitions.set(
          symbol, endOfTransition.uniqueState
        );
      }
    }

    const allUniqueStates = [...allStates.values()].map(x => x.uniqueState);

    return new Automata(start.uniqueState, ends.map(end => end.uniqueState), allUniqueStates);
  }  
}

/** A state that has unterministic transitions */
class UndeterministicState {
  /** A unique id */
  readonly id: number;
  /** The list of transitions and where they may lead */
  transitions: Map<string, UndeterministicState[]> = new Map();
  /** States that may be reached through an epsilon transition */
  epsilon: UndeterministicState[] = [];

  /** Build an undterministic state */
  constructor(id: number) {
    this.id = id;
  }

  /** Adds the given transition */
  addTransition(symbol: string, target: UndeterministicState) {
    let r = this.transitions.get(symbol);
    if (r === undefined) {
      r = [];
      this.transitions.set(symbol, r);
    }

    UndeterministicState.ensureHas(r, target);
  }

  /** Adds a state reachable with no symbol */
  addEpsilon(target: UndeterministicState) {
    UndeterministicState.ensureHas(this.epsilon, target);
  }

  /** Ensures that the list of states has the given state, without duping it */
  static ensureHas(states: UndeterministicState[], state: UndeterministicState) {
    if (!states.includes(state)) {
      states.push(state);
    }
  }
};

/** A state formed of multiple states. Used during automata minimization */
class CompoundUndeterministicState {
  /** A unique id, the id of the state in the new automata */
  readonly uniqueState: State;
  /** The states represented by this state */
  readonly states: UndeterministicState[];

  /** Build a composed state */
  constructor(id: number, states: UndeterministicState[]) {
    this.uniqueState = new State(id, new Map());
    this.states = states
  }

  /**
   * Generates a list of states with the states passed and the states reached by
   * an epsilon transition
   */
  static computeClosure(states_: UndeterministicState[]): UndeterministicState[] {
    let states = [...states_];

    for (let i = 0; i != states.length; ++i) {
      for (const next of states[i].epsilon) {
        UndeterministicState.ensureHas(states, next);
      }
    }

    states.sort((lhs, rhs) => lhs.id - rhs.id);

    return states;
  }

  /** Supposing the list of sorted, generates a unique key */
  static makeKey(states: UndeterministicState[]): string {
    return states.map(s => s.id.toString(16)).join("-");
  }
}

/** A finite state automata */
export class Automata {
  /** Starting state */
  readonly start: State;
  /** Validating states */
  readonly ends: State[];
  /** All existing states */
  readonly states: State[];

  /**
   * Builds a new finite state automata
   * @param start The starting node
   * @param ends The end node
   * @param allStates Every known states. start and ends should be included in
   * it.
   */
  constructor(start: State, ends: State[], allStates: State[]) {
    this.start = start;
    this.ends = ends;
    this.states = allStates;
  }

  /**
   * Test if the given sequence is accepted by the automata.
   * @param sequence The sequence
   * @returns True if from the starting node, the given sequence can be used
   * to reach one of the end of the automata.
   */
  test(sequence: string[]): boolean {
    let current = this.start;

    for (const word of sequence) {
      let nextState = current.next(word);
      if (nextState === null) return false;
      current = nextState;
    }

    return this.ends.includes(current);
  }

  /**
   * Gives a string representation of the automata
   */
  /* istanbul ignore next */
  toLongString(): string {
    let s: string[] = [];

    for (const state of this.states) {
      let line = `State ${state.id}`;
      for (const [symbol, next] of state.transitions) {
        line += "\n- " + symbol + " -> " + next.id;
      }
      s.push(line);
    }

    return s.join("\n");
  }
}

/**
 * A state in a finite state automata
 */
export class State {
  /** A unique id */
  readonly id: number;
  /** The list of transitions */
  readonly transitions: Map<string, State>;

  /**
   * Builds a new state
   * @param id The id of the state
   * @param transitions The list of transitions
   */
  constructor(id: number, transitions: Map<string, State>) {
    this.id = id;
    this.transitions = transitions;
  }

  /**
   * Returns the state after travelling through the given symbol
   * @param symbol The symbol used
   * @returns The state at the end of the transition corresponding to the given
   * symbol, or null if there is no such state
   */
  next(symbol: string): State | null {
    const nextState = this.transitions.get(symbol);
    if (nextState === undefined) return null;
    return nextState;
  }
}
