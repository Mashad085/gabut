      *================================================================*
      * CFBUDGET.cbl - Budget Validation & Spending Analysis          *
      * Args: action= budgeted= spent= amount= category=              *
      * Actions: VALIDATE-SPEND | CALC-REMAINING | ANALYZE            *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CFBUDGET.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. LINUX.
       OBJECT-COMPUTER. LINUX.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       01  WS-ACTION           PIC X(20)  VALUE SPACES.
       01  WS-BUDGETED         PIC 9(13)V99 VALUE ZEROS.
       01  WS-SPENT            PIC 9(13)V99 VALUE ZEROS.
       01  WS-AMOUNT           PIC 9(13)V99 VALUE ZEROS.
       01  WS-TOTAL-INCOME     PIC 9(13)V99 VALUE ZEROS.
       01  WS-TOTAL-BUDGETED   PIC 9(13)V99 VALUE ZEROS.

       01  WS-STATUS           PIC X(10)  VALUE 'OK'.
       01  WS-MSG              PIC X(200) VALUE SPACES.
       01  WS-REMAINING        PIC S9(13)V99 VALUE ZEROS.
       01  WS-PCT-USED         PIC 9(3)V99 VALUE ZEROS.
       01  WS-HEALTH           PIC X(10)  VALUE SPACES.
       01  WS-NEW-SPENT        PIC 9(13)V99 VALUE ZEROS.
       01  WS-UNBUDGETED       PIC S9(13)V99 VALUE ZEROS.

       01  WS-REM-D            PIC Z(13).99.
       01  WS-PCT-D            PIC ZZ9.99.
       01  WS-NEWSP-D          PIC Z(13).99.
       01  WS-UNBUD-D          PIC Z(13).99.
       01  WS-OUT              PIC X(500) VALUE SPACES.

       01  WS-ARG-COUNT        PIC 9(3).
       01  WS-ARG-IDX          PIC 9(3).
       01  WS-ARG-VAL          PIC X(200).
       01  WS-KEY              PIC X(30).
       01  WS-VAL              PIC X(150).
       01  WS-POS              PIC 9(4).

       PROCEDURE DIVISION.
       0000-MAIN.
           PERFORM 1000-READ-ARGS
           PERFORM 2000-PROCESS
           PERFORM 9000-OUTPUT
           STOP RUN.

       1000-READ-ARGS.
           ACCEPT WS-ARG-COUNT FROM ARGUMENT-NUMBER
           MOVE 1 TO WS-ARG-IDX
           PERFORM UNTIL WS-ARG-IDX > WS-ARG-COUNT
               ACCEPT WS-ARG-VAL FROM ARGUMENT-VALUE
               PERFORM 1100-PARSE
               ADD 1 TO WS-ARG-IDX
           END-PERFORM.

       1100-PARSE.
           MOVE ZERO TO WS-POS
           INSPECT WS-ARG-VAL TALLYING WS-POS
               FOR CHARACTERS BEFORE '='
           IF WS-POS > 0
               MOVE WS-ARG-VAL(1:WS-POS)       TO WS-KEY
               MOVE WS-ARG-VAL(WS-POS + 2:100) TO WS-VAL
               EVALUATE FUNCTION TRIM(WS-KEY)
                   WHEN 'action'
                       MOVE FUNCTION TRIM(WS-VAL) TO WS-ACTION
                   WHEN 'budgeted'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-BUDGETED
                   WHEN 'spent'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-SPENT
                   WHEN 'amount'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-AMOUNT
                   WHEN 'total_income'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-TOTAL-INCOME
                   WHEN 'total_budgeted'
                       MOVE FUNCTION NUMVAL(WS-VAL)
                           TO WS-TOTAL-BUDGETED
               END-EVALUATE
           END-IF.

       2000-PROCESS.
           EVALUATE FUNCTION TRIM(WS-ACTION)
               WHEN 'VALIDATE-SPEND'
                   PERFORM 3000-VALIDATE-SPEND
               WHEN 'CALC-REMAINING'
                   PERFORM 4000-CALC-REMAINING
               WHEN 'ANALYZE'
                   PERFORM 5000-ANALYZE
               WHEN OTHER
                   MOVE 'ERROR' TO WS-STATUS
                   MOVE 'Action tidak dikenal' TO WS-MSG
           END-EVALUATE.

       3000-VALIDATE-SPEND.
           COMPUTE WS-REMAINING = WS-BUDGETED - WS-SPENT
           IF WS-AMOUNT <= ZEROS
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah pengeluaran harus lebih dari 0' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           COMPUTE WS-NEW-SPENT = WS-SPENT + WS-AMOUNT
           IF WS-BUDGETED > ZEROS
               IF WS-NEW-SPENT > WS-BUDGETED
                   MOVE 'WARN' TO WS-STATUS
                   MOVE 'Pengeluaran melebihi anggaran kategori ini'
                       TO WS-MSG
               ELSE
                   COMPUTE WS-PCT-USED =
                       (WS-NEW-SPENT / WS-BUDGETED) * 100
                   IF WS-PCT-USED > 80
                       MOVE 'WARN' TO WS-STATUS
                       MOVE 'Anggaran hampir habis (>80%)' TO WS-MSG
                   ELSE
                       MOVE 'OK' TO WS-STATUS
                       MOVE 'Pengeluaran dalam batas anggaran' TO WS-MSG
                   END-IF
               END-IF
           ELSE
               MOVE 'OK' TO WS-STATUS
               MOVE 'Tidak ada batas anggaran untuk kategori ini'
                   TO WS-MSG
           END-IF.

       4000-CALC-REMAINING.
           COMPUTE WS-REMAINING = WS-BUDGETED - WS-SPENT
           COMPUTE WS-NEW-SPENT = WS-SPENT + WS-AMOUNT
           IF WS-BUDGETED > ZEROS
               COMPUTE WS-PCT-USED = (WS-SPENT / WS-BUDGETED) * 100
           ELSE
               MOVE ZEROS TO WS-PCT-USED
           END-IF
           MOVE 'Sisa anggaran dihitung' TO WS-MSG.

       5000-ANALYZE.
           COMPUTE WS-UNBUDGETED = WS-TOTAL-INCOME - WS-TOTAL-BUDGETED
           COMPUTE WS-REMAINING  = WS-TOTAL-INCOME - WS-TOTAL-BUDGETED
           IF WS-TOTAL-INCOME > ZEROS
               COMPUTE WS-PCT-USED =
                   (WS-TOTAL-BUDGETED / WS-TOTAL-INCOME) * 100
           ELSE
               MOVE ZEROS TO WS-PCT-USED
           END-IF
           EVALUATE TRUE
               WHEN WS-PCT-USED > 100
                   MOVE 'DANGER'  TO WS-HEALTH
                   MOVE 'Anggaran melebihi pemasukan!' TO WS-MSG
               WHEN WS-PCT-USED > 80
                   MOVE 'WARNING' TO WS-HEALTH
                   MOVE 'Anggaran hampir memenuhi pemasukan' TO WS-MSG
               WHEN WS-PCT-USED > 50
                   MOVE 'FAIR'    TO WS-HEALTH
                   MOVE 'Alokasi anggaran cukup baik' TO WS-MSG
               WHEN OTHER
                   MOVE 'GOOD'    TO WS-HEALTH
                   MOVE 'Kondisi anggaran sangat baik' TO WS-MSG
           END-EVALUATE.

       9000-OUTPUT.
           MOVE WS-REMAINING TO WS-REM-D
           MOVE WS-PCT-USED  TO WS-PCT-D
           MOVE WS-NEW-SPENT TO WS-NEWSP-D
           MOVE WS-UNBUDGETED TO WS-UNBUD-D
           MOVE SPACES TO WS-OUT
           STRING
               '{"status":"' DELIMITED SIZE
               FUNCTION TRIM(WS-STATUS) DELIMITED SIZE
               '","remaining":' DELIMITED SIZE
               FUNCTION TRIM(WS-REM-D) DELIMITED SIZE
               ',"pct_used":' DELIMITED SIZE
               FUNCTION TRIM(WS-PCT-D) DELIMITED SIZE
               ',"new_spent":' DELIMITED SIZE
               FUNCTION TRIM(WS-NEWSP-D) DELIMITED SIZE
               ',"health":"' DELIMITED SIZE
               FUNCTION TRIM(WS-HEALTH) DELIMITED SIZE
               '","unbudgeted":' DELIMITED SIZE
               FUNCTION TRIM(WS-UNBUD-D) DELIMITED SIZE
               ',"message":"' DELIMITED SIZE
               FUNCTION TRIM(WS-MSG) DELIMITED SIZE
               '"}' DELIMITED SIZE
               INTO WS-OUT
           END-STRING
           DISPLAY FUNCTION TRIM(WS-OUT).
