
#include <stdbool.h>
#include <inttypes.h>
#include <limits.h>
#include <ctype.h>
#include <stdlib.h>
#include <alloca.h>
#include <string.h>
#include <stdio.h>
#include <math.h>


#define WORD_LENGTH 5

// 5 fields, each field is 2 bits long
typedef uint32_t Pattern;
#define PATTERN_MASK 3
#define GRAY 0
#define YELLOW 1
#define GREEN 2
#define INVALID_PATTERN 3
// all greens
#define MAX_PATTERN 682

typedef struct Possible {
    uint32_t count;
    // array of bools, the length is equal to solutions.len, NOT count
    bool* data;
} Possible;

const char* RARE_LETTERS = "KWVZXQJ";

const char* BOOK_GUESSES[] = {
    "salet",
    "qajaq",
    "crane",
    "slate",
    "roate",
    "immix",
    "adieu",
    "audio",
    "ouija",
    "stare",
    "raise",
    "arise",
};


static inline void* safe_calloc(size_t size) {
    void* out = calloc(1, size);
    if (out == NULL) {
        perror("Error in calloc");
        exit(1);
    }
    return out;
}


typedef struct WordList {
    size_t len;
    char (*ptr)[WORD_LENGTH + 1];
} WordList;

static inline void load_word_list(WordList* out, char* path) {
    FILE* file = fopen(path, "r");
    if (file == NULL) {
        char msg[256];
        snprintf(msg, sizeof(msg), "Error opening %s", path);
        perror(msg);
        exit(1);
    }
    size_t len = 0;
    char c;
    while ((c = fgetc(file)) != EOF) {
        if (c == '\n') {
            len++;
        }
    }
    rewind(file);
    out->len = len;
    out->ptr = safe_calloc(len * (WORD_LENGTH + 1) * sizeof(char));
    size_t line = 0;
    size_t i = 0;
    while ((c = fgetc(file)) != EOF) {
        if (c == '\n') {
            line++;
            i = 0;
        } else {
            out->ptr[line][i] = c;
            i++;
        }
    }
    fclose(file);
}

static inline void free_word_list(WordList* list) {
    free(list->ptr);
    list->ptr = NULL;
}

WordList all_guesses;
WordList all_solutions;



typedef struct WordAndScore {
    char* word;
    double score;
} WordAndScore;

WordAndScore* first_guesses;

static inline void load_first_guesses(char* path) {
    FILE* file = fopen(path, "r");
    if (file == NULL) {
        char msg[256];
        snprintf(msg, sizeof(msg), "Error opening %s", path);
        perror(msg);
        exit(1);
    }
    size_t len = 0;
    char c;
    while ((c = fgetc(file)) != EOF) {
        if (c == '\n') {
            len++;
        }
    }
    rewind(file);
    first_guesses = safe_calloc(len * sizeof(WordAndScore));
    size_t line = 0;
    size_t i = 0;
    char current_line[256];
    while ((c = fgetc(file)) != EOF) {
        if (c == '\n') {
            WordAndScore* data = &first_guesses[line];
            data->word = all_guesses.ptr[line];
            current_line[i] = '\0';
            data->score = strtod(current_line, NULL);
            line++;
            i = 0;
        } else {
            current_line[i] = c;
            i++;
        }
    }
    fclose(file);
}

static inline void free_first_guesses() {
    free(first_guesses);
    first_guesses = NULL;
}


static inline Pattern get_pattern(char* guess, char* target) {
    static uint8_t counts['z' + 1];
    // clear counts array
    memset(&counts['a'], 0, 'z' - 'a' + 1);
    Pattern pattern = 0;
    // first resolve greens and add to counts
    for (int i = 0; i < WORD_LENGTH; i++) {
        if (guess[i] == target[i]) {
            pattern |= GREEN * (1 << (i * 2));
        } else {
            counts[(int)target[i]]++;
        }
    }
    // next go through counts to add yellows
    for (int i = 0; i < WORD_LENGTH; i++) {
        char c = guess[i];
        if (c != target[i]) {
            uint8_t value = counts[(int)c];
            if (value > 0) {
                pattern |= YELLOW * (1 << (i * 2));
            }
        }
    }
    return pattern;
}

// static inline void print_pattern(Pattern p) {
//     for (int i = 0; i < WORD_LENGTH; i++) {
//         if ((p & PATTERN_MASK) == GREEN) {

//         } else if ((p & PATTERN_MASK) == YELLOW) {

//         } else {

//         }
//         p >>= 2;
//     }
// }

static inline void update_possible(Possible* possible, char* guess, char* answer) {
    Pattern target = get_pattern(guess, answer);
    for (uint32_t i = 0; i < all_solutions.len; i++) {
        if (!possible->data[i]) {
            continue;
        }
        if (target != get_pattern(guess, all_solutions.ptr[i])) {
            possible->data[i] = false;
            possible->count--;
        }
    }
}

static inline double score_guess_information(Possible* possible, char* guess) {
    uint32_t out = 0;
    for (uint32_t i = 0; i < all_solutions.len; i++) {
        if (!possible->data[i]) {
            continue;
        }
        if (possible->count == 1) {
            if (strcmp(guess, all_solutions.ptr[i]) == 0) {
                return 0;
            } else {
                return INFINITY;
            }
        }
        Pattern target = get_pattern(guess, all_solutions.ptr[i]);
        if (target == MAX_PATTERN) {
            continue;
        }
        for (uint32_t j = 0; j < all_solutions.len; j++) {
            if (!possible->data[j]) {
                continue;
            }
            if (target == get_pattern(guess, all_solutions.ptr[j])) {
                out++;
            }
        }
    }
    return (double)out / (double)(possible->count);
}

static inline double score_guess(Possible* possible, char* guess);

// static inline double score_guess_tree(Possible* possible, char* guess) {
//     if (possible->count == 1) {
//         for (uint32_t i = 0; i < all_solutions.len; i++) {
//             if (possible->data[i]) {
//                 if (strncmp(guess, all_solutions.ptr[i], WORD_LENGTH) == 0) {
//                     return 0.0;
//                 } else {
//                     return 1.0;
//                 }
//             }
//         }
//         return 1.0;
//     }
//     Possible new_possible;
//     new_possible.data = alloca(all_solutions.len * sizeof(bool));
//     uint32_t counts[MAX_PATTERN + 1];
//     memset(counts, 0, (MAX_PATTERN + 1) * sizeof(uint32_t));
//     for (uint32_t i = 0; i < all_solutions.len; i++) {
//         if (!possible->data[i]) {
//             continue;
//         }
//         Pattern pattern = get_pattern(guess, all_solutions.ptr[i]);
//         counts[pattern]++;
//     }
//     double out = 0;
//     for (Pattern pattern = 0; pattern < MAX_PATTERN + 1; pattern++) {
//         uint32_t count = counts[pattern];
//         if (count == 0) {
//             continue;
//         }
//         if (pattern == MAX_PATTERN) {
//             continue;
//         }
//         new_possible.count = possible->count;
//         memcpy(new_possible.data, possible->data, all_solutions.len * sizeof(bool));
//         for (uint32_t i = 0; i < all_solutions.len; i++) {
//             if (!new_possible.data[i]) {
//                 continue;
//             }
//             if (pattern != get_pattern(guess, all_solutions.ptr[i])) {
//                 new_possible.data[i] = false;
//                 new_possible.count--;
//             }
//         }
//         double value;
//         if (new_possible.count == possible->count) {
//             // prevent infinite recursion
//             continue;
//         } else if (new_possible.count == 1) {
//             // shortcut
//             value = 1.0;
//         } else {
//             double best = INFINITY;
//             for (uint32_t i = 0; i < all_guesses.len; i++) {
//                 double new = score_guess(&new_possible, all_guesses.ptr[i]);
//                 if (new < best) {
//                     best = new;
//                 }
//             }
//             if (best == INFINITY) {
//                 fprintf(stderr, "Failed to find best guess\n");
//                 continue;
//             }
//             value = best;
//         }
//         out += count * (1.0 + value);
//     }
//     if (out == 0) {
//         out = INFINITY;
//     }
//     // printf("%s: %.3f\n", guess, out / (double)possible->count);
//     return out / (double)possible->count;
// }

static inline double score_guess(Possible* possible, char* guess) {
    // if (possible->count <= 0) {
    //     return score_guess_tree(possible, guess);
    // } else {
        return score_guess_information(possible, guess);
    // }
}

static inline int word_and_score_sorter(const void* _x, const void* _y) {
    double x = ((WordAndScore*)_x)->score;
    double y = ((WordAndScore*)_y)->score;
    if (x == INFINITY) {
        if (y == INFINITY) {
            return 0;
        } else {
            return -1;
        }
    } else {
        if (y == INFINITY) {
            return 1;
        } else {
            return (int)((y - x) * 100000.0);
        }
    }
}

static inline int word_and_score_sorter_2(const void* x, const void* y) {
    return strncmp(((WordAndScore*)x)->word, ((WordAndScore*)y)->word, WORD_LENGTH);
}

static inline void rank_guesses(WordAndScore* out, Possible* possible) {
    char* only_good_word = NULL;
    if (possible->count == 1) {
        for (uint32_t i = 0; i < all_solutions.len; i++) {
            if (possible->data[i]) {
                only_good_word = all_solutions.ptr[i];
            }
        }
    }
    for (uint32_t i = 0; i < all_guesses.len; i++) {
        char* guess = all_guesses.ptr[i];
        out[i].word = guess;
        if (only_good_word != NULL) {
            if (strcmp(guess, only_good_word) == 0) {
                out[i].score = 0.0;
            } else {
                out[i].score = 1.0;
            }
        } else {
            out[i].score = score_guess(possible, guess);
        }
        // if (i % 1000 == 0 && i > 0) {
        //     qsort(out, i + 1, sizeof(WordAndScore), word_and_score_sorter);
        //     printf("%i/%zu: current: %s, best: %s (%.3f) or %s (%.3f), worst: %s (%.3f) or %s (%.3f)\n", i, all_guesses.len, guess, out[i].word, out[i].score, out[i - 1].word, out[i - 1].score, out[0].word, out[0].score, out[1].word, out[1].score);
        // }
    }
    qsort(out, all_guesses.len, sizeof(WordAndScore), word_and_score_sorter);
    // printf("best: %s (%.3f) or %s (%.3f), worst: %s (%.3f) or %s (%.3f)\n", out[all_guesses.len - 1].word, out[all_guesses.len - 1].score, out[all_guesses.len - 2].word, out[all_guesses.len - 2].score, out[0].word, out[0].score, out[1].word, out[1].score);
    // if (possible->count <= 2) {
    //     // qsort(out, all_guesses.len, sizeof(WordAndScore), word_and_score_sorter_2);
    //     for (size_t i = 0; i < all_guesses.len; i++) {
    //         printf("%s: %.3f\n", out[i].word, out[i].score);
    //     }
    //     exit(0);
    // }
}


static inline int uint32_sorter(const void* x, const void* y) {
    return (int)((*(uint32_t*)y) - (*(uint32_t*)x));
}

static inline void to_uppercase(char* out, char* in) {
    for (int i = 0; i < WORD_LENGTH; i++) {
        out[i] = toupper(in[i]);
    }
}

static inline void rate_game(char** guesses, int guess_count, char* answer) {
    Possible possible;
    possible.count = all_solutions.len;
    possible.data = safe_calloc(all_solutions.len * sizeof(bool));
    memset(possible.data, true, all_solutions.len);
    Possible next_possible;
    next_possible.count = all_solutions.len;
    next_possible.data = safe_calloc(all_solutions.len * sizeof(bool));
    memset(next_possible.data, true, all_solutions.len);
    double total_skill = 0;
    double skill_guesses = 0;
    double total_luck = 0;
    double luck_guesses = 0;
    size_t previous_guesses_size = (guess_count * WORD_LENGTH + 1) * sizeof(char);
    char* previous_guesses = safe_calloc(previous_guesses_size);
    memset(previous_guesses, '\0', previous_guesses_size);
    WordAndScore* data = safe_calloc(all_guesses.len * sizeof(WordAndScore));
    Pattern* pattern_counts = safe_calloc((MAX_PATTERN + 1) * sizeof(Pattern));
    uint32_t* distr = safe_calloc(all_solutions.len * sizeof(uint32_t));
    for (int i = 0; i < guess_count; i++) {
        char* guess = guesses[i];
        possible.count = next_possible.count;
        memcpy(possible.data, next_possible.data, all_solutions.len * sizeof(bool));
        update_possible(&next_possible, guess, answer);
        if (i == 0) {
            memcpy(data, first_guesses, all_guesses.len * sizeof(WordAndScore));
            qsort(data, all_guesses.len, sizeof(WordAndScore), word_and_score_sorter);
        } else {
            rank_guesses(data, &possible);
        }
        uint32_t skill_index;
        for (skill_index = 0; skill_index < all_guesses.len; skill_index++) {
            if (strncmp(guess, data[skill_index].word, WORD_LENGTH) == 0) {
                break;
            }
        }
        if (skill_index == all_guesses.len) {
            fprintf(stderr, "Error while finding skill\n");
            exit(1);
        }
        double guess_score = data[skill_index].score;
        // change index to be the earliest one with the same score
        for (skill_index = 0; skill_index < all_guesses.len; skill_index++) {
            if (guess_score == data[skill_index].score) {
                break;
            }
        }
        double skill;
        if (guess_score == data[all_guesses.len - 1].score) {
            skill = 100.0;
        } else {
            skill = skill_index * 100.0 / all_guesses.len;
        }
        // calculate luck:
        // find the distribution of remaining possible answers
        // and rank it by its position in there
        // memset(pattern_counts, 0, (MAX_PATTERN + 1) * sizeof(Pattern));
        // for (uint32_t i = 0; i < all_solutions.len; i++) {
        //     Pattern pattern = get_pattern(guess, all_solutions.ptr[i]);
        //     pattern_counts[pattern]++;
        // }
        // size_t distr_len = 0;
        // for (uint32_t i = 0; i < MAX_PATTERN + 1; i++) {
        //     if (pattern_counts[i] > 0) {
        //         distr[distr_len] = pattern_counts[i];
        //         distr_len++;
        //     }
        // }
        size_t distr_len = 0;
        for (uint32_t i = 0; i < all_solutions.len; i++) {
            if (!possible.data[i]) {
                continue;
            }
            Pattern target = get_pattern(guess, all_solutions.ptr[i]);
            uint32_t value = 0;
            for (uint32_t j = 0; j < all_solutions.len; j++) {
                if (!possible.data[j]) {
                    continue;
                }
                if (target == get_pattern(guess, all_solutions.ptr[j])) {
                    value++;
                }
            }
            distr[distr_len] = value;
            distr_len++;
        }
        qsort(distr, distr_len, sizeof(uint32_t), uint32_sorter);
        uint32_t luck_index;
        for (luck_index = 0; luck_index < distr_len; luck_index++) {
            if (next_possible.count == distr[luck_index]) {
                break;
            }
        }
        if (luck_index == distr_len) {
            fprintf(stderr, "Error while finding luck: distr_len = %zu, possible.count = %"PRIu32", next_possible.count = %"PRIu32", distr[0] = %"PRIu32", distr[distr_len - 1] = %"PRIu32"\n", distr_len, possible.count, next_possible.count, distr[0], distr[distr_len - 1]);
            exit(1);
        }
        double luck;
        if (distr[0] == distr[distr_len - 1]) {
            luck = -1.0;
        } else {
            if (distr[luck_index] == distr[distr_len - 1]) {
                luck = 100.0;
            } else {
                luck = luck_index * 100.0 / distr_len;
            }
        }
        if (i > 0) {
            total_skill += skill;
            skill_guesses++;
        }
        if (luck != -1.0) {
            total_luck += luck;
            luck_guesses++;
        }
        char* emoji = "";
        if (i == 0) {
            for (size_t i = 0; i < (sizeof(BOOK_GUESSES) / (sizeof(BOOK_GUESSES[0]))); i++) {
                if (strncmp(guess, BOOK_GUESSES[i], WORD_LENGTH) == 0) {
                    emoji = ":book:";
                }
            }
        }
        if (strncmp(emoji, ":book:", 6) == 0) {
            // do nothing
        } else if (strncmp(guess, answer, WORD_LENGTH) == 0) {
            emoji = ":winner:";
        } else if (possible.count == 1) {
            emoji = ":miss:";
        } else if (skill == 100) {
            emoji = ":best:";
            if (possible.count > 2) {
                for (int i = 0; RARE_LETTERS[i] != '\0'; i++) {
                    char letter = RARE_LETTERS[i];
                    if (strchr(guess, letter) != NULL && strchr(previous_guesses, letter) == NULL) {
                        emoji = ":brilliant:";
                        break;
                    }
                }
            }
        } else if (skill > 90) {
            emoji = ":excellent:";
            if (possible.count > 2) {
                for (int i = 0; RARE_LETTERS[i] != '\0'; i++) {
                    char letter = RARE_LETTERS[i];
                    if (strchr(guess, letter) != NULL && strchr(previous_guesses, letter) == NULL) {
                        emoji = ":great:";
                        break;
                    }
                }
            }
        } else if (skill > 70) {
            emoji = ":good:";
        } else if (skill > 50) {
            emoji = ":inaccuracy:";
        } else if (skill > 30) {
            emoji = ":mistake:";
        } else {
            emoji = ":blunder:";
        }
        printf("%s `%s` - %i skill, ", emoji, guess, (int)trunc(skill));
        if (luck == -1.0) {
            printf("no ");
        } else {
            printf("%i ", (int)trunc(luck));
        }
        printf("luck, remaining: %"PRIu32", ranking: `", next_possible.count);
        printf("%s/", data[all_guesses.len - 1].word);
        if (data[all_guesses.len - 2].score != 1.0) {
            printf("%s/", data[all_guesses.len - 2].word);
            if (data[all_guesses.len - 3].score != 1.0) {
                printf("%s/", data[all_guesses.len - 3].word);
                if (data[all_guesses.len - 4].score != 1.0) {
                    printf("%s/", data[all_guesses.len - 4].word);
                }
            }
        }
        printf("...");
        if (i == 0) {
            printf("/%s", data[0].word);
        }
        printf("`\n");
        strncat(previous_guesses, guess, WORD_LENGTH);
    }
    printf("Overall: %i skill, %i luck\n", (int)trunc(total_skill / skill_guesses), (int)trunc(total_luck / luck_guesses));
    free(possible.data);
    free(next_possible.data);
    free(previous_guesses);
    free(data);
    free(pattern_counts);
    free(distr);
}


int main(int argc, char** argv) {
    if (argc < 4) {
        fprintf(stderr, "Expected at least 4 arguments");
    }
    load_word_list(&all_guesses, argv[1]);
    load_word_list(&all_solutions, argv[2]);
    load_first_guesses(argv[3]);
    rate_game(argv + 5, argc - 5, argv[4]);
    free_first_guesses();
    free_word_list(&all_guesses);
    free_word_list(&all_solutions);
    return 0;
}

