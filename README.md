# Automata Composer

This package lets users build finite state automata by composing
automatas with the operators `chain` (concatenation), `or` (|),
`maybe` (?), `star` (*) and `plus` (+).

Transitions are strings of any length and minimization is automatically applied
when the automata is built.


## How to use

### Recognize a word

```js
import { unit } from "@bruju/automata-composer"; 
const automata = unit("hamster").build();
console.log(automata.test(["hamster"])); // true
console.log(automata.test(["ham", "ster"])); // false
```


### Recognize a known sequence

```js
import { chain, unit } from "@bruju/automata-composer"; 
const helloWorld = chain(unit("Hello"), unit("world")).build();

console.log(helloWorld.test(["Hello", "world"])); // true
```


### A more complex pattern

```js
import { chain, unit, or, plus, maybe } from "@bruju/automata-composer"; 

const theAnimals = chain(
  or(unit("Save"), unit("Kill")),
  unit("the"),
  unit("animals"),
  plus(unit("!")),
  maybe(unit("(This is a GDQ reference)"))
).build();

// Both true
console.log(theAnimals.test(["Save", "the", "animals", "!", "!", "!"]));
console.log(theAnimals.test([
  "Kill", "the", "animals", "!", "(This is a GDQ reference)"
]));
```


## Theory

Theory is partly inspired by :
- https://en.wikipedia.org/wiki/DFA_minimization
- https://www.dcs.ed.ac.uk/home/mic/FiniteStateMachines2-slides.pdf 


## License

Licensed under the MIT Licence by Julian Bruyat
