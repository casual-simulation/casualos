# Xp API Developers

### 〘 Xp API – Developer Reference 〙

---

### Table of Contents

| Section                            | Description                                                              |
| ---------------------------------- | ------------------------------------------------------------------------ |
|                                    |                                                                          |
| [Terminology](#terms)              | Defines, clarifies, and describes relevant terminology and its usage.    |
| [What Is](#about)                  | An about section, pertaining to the Xp API                               |
| [Programmatic Comments](#comments) | Describes comment prefixes and their niche in the Xp API implementation. |
| [Notes](#notes)                    | Development content.                                                     |

---

### Terms

> _Note (before you examine terms):_

Abbreviations should only be made on noun or adjective forms of their respective words.
Verbs (action) should be directly and completely specified at source, without need for terminology reference.
Shortenings do not need to contain a period (.) but are documented in [Terms](#terms) with; for sake of respect to multiple
national language norms (American & British English).

> Terminology:

<table>
  <tr>
    <th>Term</th>
    <th>Reference</th>
    <th>Context?</th>
  </tr>
  <tr>
    <td>Impl.</td>
    <td>Abbreviation for "Implementation"</td>
    <td></td>
  </tr>
  <tr>
    <td>Ref.</td>
    <td>Abbreviation for "Reference"</td>
    <td></td>
  </tr>
  <tr>
    <td>&amp;|</td>
    <td>Symbolic equivalent to "and / or"</td>
    <td>&amp; = "and", | = "or"</td>
  </tr>
  <tr>
    <td>Async.</td>
    <td>Abbreviation for "asynchronous"</td>
    <td></td>
  </tr>
  <tr>
    <td>XPA</td>
    <td>Acronym for "Xp API"</td>
    <td>The programmatic implementation supporting the XP Exchange</td>
  </tr>
  <tr>
    <td>XPE</td>
    <td>Acronym for "Xp Exchange"</td>
    <td>The system which utilizes the Xp API</td>
  </tr>
  <tr>
    <td>BOCS</td>
    <td>Acronym (non-standard) for "Beginning of Conceptual Scope"</td>
    <td>
      Useful when creating conceptual sub-scopes in an otherwise procedurally "same-scope" context.<br>
      (See <a href="#conceptual-scope-impl">Conceptual scope impl</a>.)
    </td>
  </tr>
  <tr>
  <td>EOCS</td>
  <td>Acronym (non-standard) for "End of Conceptual Scope"</td>
  <td>Used to mark the end of a previously specified conceptual scope. (See BOCS.)</td>
  </tr>
  <tr>
  <td>KASP</td>
  <td>Acronym (non-standard) for "Keys And Specified Properties"</td>
  <td>Used to denote a relationship including or between property keys an their associated values.</td>
  </tr>
  <tr>
  <td>DMC</td>
  <td>Acronym (non-standard) for "Data Model Configuration"</td>
  <td>Used to denote entities involved in configuring a dynamic data model.</td>
  </tr>
</table>

> Examples:

##### Conceptual Scope Impl:

```ts
/**
 * * BOCS: Init Cache
 *  We'll import our Cache interface and initialize the cache object.
 */
import { Cache } from '../CacheProvider.ts';
const cache: Cache = {};
// * EOCS: Init Cache
```

---

### About

In Development!

```ts
/**
 * TODO: Add about section to developers md
 */
```

---

### Comments

While not necessary, the usage of comment prefixes (which suffix the programmatic comment symbols), (grouping) is highly advised in any continuation of production within the XPA codebase.

Comment prefixes serve to optimize development communication through the asynchronous and mono-static means—presented by programmatic comments.

They (comment prefixes) do so by organizing comments via their niche, which enables the parsing / querying of relevant &| related comments.

The prefix system-standard that will appear in the XPA codebase is directly inspired by:
[Aaron Bond - Better Comments](https://marketplace.visualstudio.com/items?itemName=aaron-bond.better-comments)

Although this is not a recognized standard by orgs like (ISO, IEEE, etc...);
it is fairly popular (generally understood / accepted), due to the aforementioned optimizations.

In summary the prefixes and their niche assertions on comments are as follows:

| Prefix | Niche Assertion    |
| ------ | ------------------ |
| !      | Alerts             |
| //     | Commented Out Code |
| \*     | Highlights         |
| ?      | Queries            |
| TODO:  | To-dos             |

> Examples:

##### Comment example:

```ts
// ! This will break
/**
 * ? Why is the spread operator the only code within the function scope?
 * // function countUp(objRef, prop, quant) {...}
 * * This function impl needs work
 */
// TODO: Fix function countUp
```

---
