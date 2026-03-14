      *================================================================*
      * CFTRXVAL.cbl - Transaction Validation & Balance Calculation    *
      * Input args: action= amount= balance= txn_type= interest_rate=  *
      *             days=                                               *
      * Output stdout: JSON result                                      *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CFTRXVAL.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. LINUX.
       OBJECT-COMPUTER. LINUX.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       01  WS-ACTION            PIC X(20)  VALUE SPACES.
       01  WS-AMOUNT            PIC 9(13)V99 VALUE ZEROS.
       01  WS-BALANCE           PIC 9(13)V99 VALUE ZEROS.
       01  WS-TXN-TYPE          PIC X(10)  VALUE SPACES.
       01  WS-INT-RATE          PIC 9(3)V9(6) VALUE ZEROS.
       01  WS-DAYS              PIC 9(5)   VALUE ZEROS.

       01  WS-STATUS            PIC X(10)  VALUE 'OK'.
       01  WS-NEW-BALANCE       PIC 9(13)V99 VALUE ZEROS.
       01  WS-INTEREST          PIC 9(13)V99 VALUE ZEROS.
       01  WS-DAILY-RATE        PIC 9(3)V9(10) VALUE ZEROS.

       01  WS-MSG               PIC X(200) VALUE SPACES.
       01  WS-OUT               PIC X(500) VALUE SPACES.
       01  WS-BAL-D             PIC Z(13).99.
       01  WS-INT-D             PIC Z(13).99.

       01  WS-ARG-COUNT         PIC 9(3).
       01  WS-ARG-IDX           PIC 9(3).
       01  WS-ARG-VAL           PIC X(200).
       01  WS-KEY               PIC X(30).
       01  WS-VAL               PIC X(150).
       01  WS-POS               PIC 9(4).

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
               PERFORM 1100-PARSE-ONE-ARG
               ADD 1 TO WS-ARG-IDX
           END-PERFORM.

       1100-PARSE-ONE-ARG.
           MOVE ZERO TO WS-POS
           INSPECT WS-ARG-VAL TALLYING WS-POS
               FOR CHARACTERS BEFORE '='
           IF WS-POS > 0
               MOVE WS-ARG-VAL(1:WS-POS)       TO WS-KEY
               MOVE WS-ARG-VAL(WS-POS + 2:100) TO WS-VAL
               EVALUATE FUNCTION TRIM(WS-KEY)
                   WHEN 'action'
                       MOVE FUNCTION TRIM(WS-VAL) TO WS-ACTION
                   WHEN 'amount'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-AMOUNT
                   WHEN 'balance'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-BALANCE
                   WHEN 'txn_type'
                       MOVE FUNCTION TRIM(WS-VAL) TO WS-TXN-TYPE
                   WHEN 'interest_rate'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-INT-RATE
                   WHEN 'days'
                       MOVE FUNCTION NUMVAL(WS-VAL) TO WS-DAYS
               END-EVALUATE
           END-IF.

       2000-PROCESS.
           EVALUATE FUNCTION TRIM(WS-ACTION)
               WHEN 'VALIDATE'
                   PERFORM 3000-VALIDATE
               WHEN 'CALC-BALANCE'
                   PERFORM 4000-CALC-BALANCE
               WHEN 'CALC-INTEREST'
                   PERFORM 5000-CALC-INTEREST
               WHEN OTHER
                   MOVE 'ERROR' TO WS-STATUS
                   MOVE 'Action tidak dikenal' TO WS-MSG
           END-EVALUATE.

       3000-VALIDATE.
           MOVE 'OK' TO WS-STATUS
           MOVE WS-BALANCE TO WS-NEW-BALANCE
           IF WS-AMOUNT <= ZEROS
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah harus lebih dari 0' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           IF WS-AMOUNT > 999999999.99
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Jumlah melebihi batas maksimum' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           EVALUATE FUNCTION TRIM(WS-TXN-TYPE)
               WHEN 'DEBIT'
               WHEN 'TRANSFER'
                   IF WS-AMOUNT > WS-BALANCE
                       MOVE 'ERROR' TO WS-STATUS
                       MOVE 'Saldo tidak mencukupi' TO WS-MSG
                   ELSE
                       SUBTRACT WS-AMOUNT FROM WS-NEW-BALANCE
                       MOVE 'Validasi berhasil' TO WS-MSG
                   END-IF
               WHEN 'CREDIT'
                   ADD WS-AMOUNT TO WS-NEW-BALANCE
                   MOVE 'Validasi berhasil' TO WS-MSG
               WHEN OTHER
                   MOVE 'ERROR' TO WS-STATUS
                   MOVE 'Tipe transaksi tidak valid' TO WS-MSG
           END-EVALUATE.

       4000-CALC-BALANCE.
           MOVE WS-BALANCE TO WS-NEW-BALANCE
           EVALUATE FUNCTION TRIM(WS-TXN-TYPE)
               WHEN 'CREDIT'
                   ADD WS-AMOUNT TO WS-NEW-BALANCE
                   MOVE 'Saldo diperbarui kredit' TO WS-MSG
               WHEN 'DEBIT'
               WHEN 'TRANSFER'
                   IF WS-AMOUNT > WS-BALANCE
                       MOVE 'ERROR' TO WS-STATUS
                       MOVE 'Saldo tidak mencukupi' TO WS-MSG
                   ELSE
                       SUBTRACT WS-AMOUNT FROM WS-NEW-BALANCE
                       MOVE 'Saldo diperbarui debit' TO WS-MSG
                   END-IF
               WHEN OTHER
                   MOVE 'ERROR' TO WS-STATUS
                   MOVE 'Tipe tidak valid' TO WS-MSG
           END-EVALUATE.

       5000-CALC-INTEREST.
           IF WS-DAYS <= ZEROS
               MOVE 'ERROR' TO WS-STATUS
               MOVE 'Hari harus lebih dari 0' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           IF WS-INT-RATE <= ZEROS
               MOVE WS-BALANCE TO WS-NEW-BALANCE
               MOVE ZEROS TO WS-INTEREST
               MOVE 'Rate 0 tidak ada bunga' TO WS-MSG
               EXIT PARAGRAPH
           END-IF
           DIVIDE 365 INTO WS-INT-RATE GIVING WS-DAILY-RATE
           MULTIPLY WS-BALANCE   BY WS-DAILY-RATE GIVING WS-INTEREST
           MULTIPLY WS-DAYS      BY WS-INTEREST   GIVING WS-INTEREST
           MOVE WS-BALANCE TO WS-NEW-BALANCE
           ADD WS-INTEREST TO WS-NEW-BALANCE
           MOVE 'Bunga dihitung' TO WS-MSG.

       9000-OUTPUT.
           MOVE WS-NEW-BALANCE TO WS-BAL-D
           MOVE WS-INTEREST    TO WS-INT-D
           MOVE SPACES TO WS-OUT
           STRING
               '{"status":"'
                   DELIMITED SIZE
               FUNCTION TRIM(WS-STATUS)
                   DELIMITED SIZE
               '","balance":'
                   DELIMITED SIZE
               FUNCTION TRIM(WS-BAL-D)
                   DELIMITED SIZE
               ',"interest":'
                   DELIMITED SIZE
               FUNCTION TRIM(WS-INT-D)
                   DELIMITED SIZE
               ',"message":"'
                   DELIMITED SIZE
               FUNCTION TRIM(WS-MSG)
                   DELIMITED SIZE
               '"}'
                   DELIMITED SIZE
               INTO WS-OUT
           END-STRING
           DISPLAY FUNCTION TRIM(WS-OUT).
