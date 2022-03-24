import assert from "assert";
import { AutomataComposer, unit, chain, plus, star, maybe, or, modifyTransitions, EPSILON } from ".";

describe("Composer", () => {
  testAutomata(
    "Empty word",
    () => new AutomataComposer(0, 0, []),
    [""], ["a", "b", "aaa"]
  );

  testAutomata(
    "Empty word with epsilon",
    () => new AutomataComposer(0, 1, [{ from: 0, to: 1, symbol: EPSILON }]),
    [""], ["a", "b", "aaa"]
  );

  testAutomata(
    "Undeterministic transition",
    () => new AutomataComposer(
      0, 1,
      [
        { from: 0, to: 1, symbol: "a" },
        { from: 0, to: 2, symbol: "a" },
        { from: 2, to: 1, symbol: "b" }
      ]
    ),
    ["a", "ab"], ["", "abb", "aab"]
  );
});

describe("Composition", () => {
  testAutomata(
    "a", () => unit("a"),
    ["a"], ["", "b", "aa", "aaa"]
  );

  testAutomata(
    "a?", () => maybe(unit("a")),
    ["", "a",],
    ["aa", "aaaa", "b", "ab", "aaab", "baaa"]
  );

  testAutomata(
    "a*", () => star(unit("a")),
    ["", "a", "aa", "aaaaa"],
    ["b", "ab", "aaab", "baaa"]
  );

  testAutomata(
    "ab", () => chain(unit("a"), unit("b")),
    ["ab"],
    ["", "a", "b", "aab", "ac", "ba"]
  );
  
  testAutomata(
    "ab*", () => chain(unit("a"), star(unit("b"))),
    ["a", "ab", "abb", "abbbbb"],
    ["", "b", "aba", "ac", "abbc"]
  );

  testAutomata(
    "a+b*", () => chain(plus(unit("a")), star(unit("b"))),
    ["a", "aaaaa", "aab", "abbbb"],
    ["", "aaaba", "aabbba", "b", "bba", "baab", "aaabbc"]
  );

  testAutomata(
    "(a | b)c",
    () => chain(or(unit("a"), unit("b")), unit("c")),
    ["ac", "bc"],
    ["a", "b", "c", "", "acc", "abc", "bca", "acc", "bcc", "aac"]
  );

  testAutomata(
    "(ac | bc)",
    () => or(
      chain(unit("a"), unit("c")),
      chain(unit("b"), unit("c"))
    ),
    ["ac", "bc"],
    ["a", "b", "c", "", "acc", "abc", "bca", "acc", "bcc", "aac"]
  );

  testAutomata(
    "(ab*c | ab*d)",
    () => or(
      chain(chain(unit("a"), star(unit("b"))), unit("c")),
      chain(chain(unit("a"), star(unit("b"))), unit("d"))
    ),
    ["ac", "abbbc", "abc", "ad", "abbbd"],
    ["a", "b", "c", "", "acc", "bca", "acc", "bcc", "aac"]
  );

  testAutomata(
    "a*a+",
    () => chain(star(unit("a")), plus(unit("a"))),
    ["a", "aaaaa", "aaaaaaaaa", "aa"],
    ["", "b"]
  );

  testAutomata(
    "b*a+",
    () => chain(star(unit("b")), plus(unit("a"))),
    ["a", "aaaaa", "aaaaaaaaa", "aa", "ba", "baaaa"],
    ["", "b"]
  );

  testAutomata(
    "(a -> b)*a+",
    () => chain(
      modifyTransitions(star(unit("a")), () => "b"),
      plus(unit("a"))
    ),
    ["a", "aaaaa", "aaaaaaaaa", "aa", "ba", "baaaa"],
    ["", "b"]
  );

  testAutomata(
    "Chain three = abc",
    () => chain(unit("a"), unit("b"), unit("c")),
    ["abc"],
    [""]
  );

  testAutomata(
    "Empty chain",
    () => chain(),
    [""], ["a"]
  );

  testAutomata(
    "a+",
    () => plus(unit("a")),
    ["a", "aa", "aaaaaa"],
    ["", "b"]
  )
});

function testAutomata(
  name: string, builder: () => AutomataComposer,
  goodWords: string[],
  badWords: string[]
) {
  it("Automata " + name, () => {
    const automata = builder().build();
    for (const goodWord of goodWords) {
      assert.ok(automata.test([...goodWord]), goodWord + " should be recognized");
    }

    for (const badWord of badWords) {
      assert.ok(!automata.test([...badWord]), badWord + " should not recognized");
    }
  });
}
