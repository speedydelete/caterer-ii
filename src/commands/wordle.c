
#include <linux/limits.h>
#include <stdbool.h>
#include <inttypes.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>


#define WORD_LENGTH 5

// 5 fields, each field is 2 bits long
typedef uint32_t Pattern;
#define GRAY 0
#define YELLOW 1
#define GREEN 2

typedef struct Possible {
    uint32_t count;
    // array of bools, the length is equal to solutions.len, NOT count
    bool* data;
} Possible;

const char* RARE_LETTERS = "KWVZXQJ";


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
}

static inline void free_word_list(WordList* list) {
    free(list->ptr);
}

WordList all_guesses;
WordList all_solutions;



typedef struct WordAndScore {
    char* word;
    double score;
} WordAndScore;

// WordAndScore first_guess_data[];


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

static inline void update_possible(Possible* possible, char* guess, char* answer) {
    Pattern target = get_pattern(guess, answer);
    for (uint32_t i = 0; i < all_solutions.len; i++) {
        if (!possible->data[i]) {
            continue;
        }
        if (target == get_pattern(guess, all_solutions.ptr[i])) {
            possible->data[i] = false;
            possible->count--;
        }
    }
}

static inline double score_guess(Possible* possible, char* guess) {
    uint32_t out = 0;
    for (uint32_t i = 0; i < all_solutions.len; i++) {
        if (!possible->data[i]) {
            continue;
        }
        Pattern target = get_pattern(guess, all_solutions.ptr[i]);
        for (uint32_t i = 0; i < all_solutions.len; i++) {
            if (!possible->data[i]) {
                continue;
            }
            if (target == get_pattern(guess, all_solutions.ptr[i])) {
                out++;
            }
        }
    }
    return (double)out / (double)(possible->count);
}

static inline int word_and_score_sorter(const void* x, const void* y) {
    return (int)(((WordAndScore*)x)->score - ((WordAndScore*)y)->score);
}

static inline void rank_guesses(WordAndScore* out, Possible* possible) {
    for (uint32_t i = 0; i < all_guesses.len; i++) {
        char* word = all_guesses.ptr[i];
        out[i].word = word;
        out[i].score = score_guess(possible, word);
        if (i % 100 == 0 && i > 0) {
            printf("%i/%zu\n", i, all_guesses.len);
        }
    }
    qsort(out, all_guesses.len, sizeof(WordAndScore), word_and_score_sorter);
    if (possible->count > 2000) {
        for (size_t i = 0; i < all_guesses.len; i++) {
            printf("%s: %.17f\n", out[i].word, out[i].score);
        }
    }
}


static inline int double_sorter(const void* x, const void* y) {
    return (int)((*(double*)y) - (*(double*)x));
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
    double total_luck = 0;
    size_t previous_guesses_size = (guess_count * WORD_LENGTH + 1) * sizeof(char);
    char* previous_guesses = safe_calloc(previous_guesses_size);
    memset(previous_guesses, '\0', previous_guesses_size);
    WordAndScore* data = safe_calloc(all_guesses.len * sizeof(WordAndScore));
    double* distr = safe_calloc(all_solutions.len * sizeof(WordAndScore));
    for (int i = 0; i < guess_count; i++) {
        char* guess = guesses[i];
        memcpy(next_possible.data, possible.data, all_solutions.len * sizeof(bool));
        update_possible(&next_possible, guess, answer);
        rank_guesses(data, &possible);
        uint32_t skill_index;
        for (skill_index = 0; skill_index < all_guesses.len; skill_index++) {
            if (strcmp(guess, data[skill_index].word) == 0) {
                break;
            }
        }
        if (skill_index == all_guesses.len) {
            fprintf(stderr, "Error while finding skill");
            exit(1);
        }
        double guess_score = data[skill_index].score;
        double best_guess_score = data[all_guesses.len - 1].score;
        double skill;
        if (guess_score == best_guess_score) {
            skill = 100.0;
        } else {
            skill = skill_index * 100.0 / all_guesses.len;
        }
        // calculate luck: find the distribution of next guesses
        // and rank it by its position in there
        uint32_t loc = 0;
        for (uint32_t i = 0; i < possible.count; i++) {
            if (!possible.data[i]) {
                continue;
            }
            Pattern target = get_pattern(guess, all_solutions.ptr[i]);
            double value = 0.0;
            for (uint32_t i = 0; i < all_solutions.len; i++) {
                if (!possible.data[i]) {
                    continue;
                }
                if (target == get_pattern(guess, all_solutions.ptr[i])) {
                    value++;
                }
            }
            distr[loc] = value;
            loc++;
        }
        size_t distr_size = loc;
        qsort(distr, distr_size, sizeof(double), double_sorter);
        uint32_t luck_index;
        for (luck_index = 0; luck_index < all_guesses.len; luck_index++) {
            if (next_possible.count == distr[luck_index]) {
                break;
            }
        }
        if (luck_index == all_guesses.len) {
            fprintf(stderr, "Error while finding luck");
            exit(1);
        }
        double luck;
        if (distr[luck_index] == distr[distr_size - 1]) {
            luck = 100.0;
        } else {
            luck = luck_index * 100.0 / all_guesses.len;
        }
        if (i > 0) {
            total_skill += skill;
        }
        total_luck += luck;
        char* emoji;
        if (strncmp(guess, answer, WORD_LENGTH) == 0) {
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
        char u_guess[WORD_LENGTH + 1];
        to_uppercase(u_guess, guess);
        char u_best1[WORD_LENGTH + 1];
        to_uppercase(u_best1, data[all_guesses.len - 1].word);
        char u_best2[WORD_LENGTH + 1];
        to_uppercase(u_best2, data[all_guesses.len - 2].word);
        char u_best3[WORD_LENGTH + 1];
        to_uppercase(u_best3, data[all_guesses.len - 3].word);
        char u_worst[WORD_LENGTH + 1];
        to_uppercase(u_worst, data[0].word);
        printf("%s `%s` - %i skill, %i luck, score: %.3f (best: %.3f), ranking: `%s/%s/%s/.../%s`\n", emoji, u_guess, (int)trunc(skill), (int)trunc(luck), guess_score, best_guess_score, u_best1, u_best2, u_best3, u_worst);
        strncat(previous_guesses, guess, WORD_LENGTH);
    }
    printf("Overall: %i skill, %i luck\n", (int)trunc(total_skill / (guess_count - 1)), (int)trunc(total_luck / guess_count));
    free(data);
}


int main(int argc, char** argv) {
    if (argc < 4) {
        fprintf(stderr, "Expected at least 4 arguments");
    }
    load_word_list(&all_guesses, argv[1]);
    load_word_list(&all_solutions, argv[2]);
    // read_first_guess_data(argv[3]);
    rate_game(argv + 5, argc - 5, argv[4]);
    free_word_list(&all_guesses);
    free_word_list(&all_solutions);
    return 0;
}
