      *================================================================*
      * CFBATCH.cbl - Batch Interest Processor                         *
      * Arg 1: path to input file                                      *
      * Lines: action=INTEREST account_id=X balance=N rate=N days=N    *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID. CFBATCH.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. LINUX.
       OBJECT-COMPUTER. LINUX.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT BATCH-INPUT ASSIGN TO DYNAMIC WS-INFILE
               ORGANIZATION IS LINE SEQUENTIAL.

       DATA DIVISION.
       FILE SECTION.
       FD  BATCH-INPUT.
       01  INPUT-RECORD        PIC X(500).

       WORKING-STORAGE SECTION.
       01  WS-INFILE           PIC X(200) VALUE SPACES.
       01  WS-EOF              PIC X VALUE 'N'.
       01  WS-TOTAL-INTEREST   PIC 9(15)V99 VALUE ZEROS.
       01  WS-TOTAL-ACCOUNTS   PIC 9(7) VALUE ZEROS.
       01  WS-ACCT-D            PIC ZZZ9999 VALUE ZEROS.
       01  WS-TOTAL-BALANCE    PIC 9(15)V99 VALUE ZEROS.

       01  WS-ACTION           PIC X(20) VALUE SPACES.
       01  WS-ACCOUNT-ID       PIC X(50) VALUE SPACES.
       01  WS-BALANCE          PIC 9(13)V99 VALUE ZEROS.
       01  WS-RATE             PIC 9(3)V9(6) VALUE ZEROS.
       01  WS-DAYS             PIC 9(5) VALUE ZEROS.
       01  WS-AMOUNT           PIC 9(13)V99 VALUE ZEROS.
       01  WS-TXN-TYPE         PIC X(10) VALUE SPACES.

       01  WS-DAILY-RATE       PIC 9(3)V9(10) VALUE ZEROS.
       01  WS-INTEREST         PIC 9(13)V99 VALUE ZEROS.
       01  WS-NEW-BALANCE      PIC 9(13)V99 VALUE ZEROS.

       01  WS-INT-D            PIC Z(13).99.
       01  WS-BAL-D            PIC Z(13).99.
       01  WS-NEWBAL-D         PIC Z(13).99.
       01  WS-TOTINT-D         PIC Z(15).99.
       01  WS-TOTBAL-D         PIC Z(15).99.
       01  WS-OUT              PIC X(500) VALUE SPACES.

       01  WS-REMAIN           PIC X(500) VALUE SPACES.
       01  WS-TOKEN            PIC X(250) VALUE SPACES.
       01  WS-FIELD-NAME       PIC X(30) VALUE SPACES.
       01  WS-FIELD-VAL        PIC X(200) VALUE SPACES.
       01  WS-POS              PIC 9(4) VALUE ZEROS.
       01  WS-FIRST-REC        PIC X VALUE 'Y'.

       PROCEDURE DIVISION.
       0000-MAIN.
           ACCEPT WS-INFILE FROM ARGUMENT-VALUE
           IF FUNCTION TRIM(WS-INFILE) = SPACES
               DISPLAY '{"error":"Usage: cfbatch <input-file>"}'
               STOP RUN
           END-IF
           DISPLAY '{"batch_results":['
           OPEN INPUT BATCH-INPUT
           MOVE 'N' TO WS-EOF
           MOVE 'Y' TO WS-FIRST-REC
           PERFORM UNTIL WS-EOF = 'Y'
               READ BATCH-INPUT INTO INPUT-RECORD
                   AT END MOVE 'Y' TO WS-EOF
                   NOT AT END PERFORM 2000-PROCESS-LINE
               END-READ
           END-PERFORM
           CLOSE BATCH-INPUT
           PERFORM 9000-SUMMARY
           STOP RUN.

       2000-PROCESS-LINE.
           MOVE SPACES TO WS-ACTION WS-ACCOUNT-ID WS-TXN-TYPE
           MOVE ZEROS TO WS-BALANCE WS-RATE WS-DAYS WS-AMOUNT
           MOVE FUNCTION TRIM(INPUT-RECORD) TO WS-REMAIN
           PERFORM UNTIL FUNCTION TRIM(WS-REMAIN) = SPACES
               PERFORM 2100-EXTRACT-TOKEN
               IF FUNCTION TRIM(WS-TOKEN) NOT = SPACES
                   PERFORM 2200-PARSE-TOKEN
               END-IF
           END-PERFORM
           EVALUATE FUNCTION TRIM(WS-ACTION)
               WHEN 'INTEREST'
                   PERFORM 3000-CALC-INTEREST
               WHEN OTHER
                   CONTINUE
           END-EVALUATE.

       2100-EXTRACT-TOKEN.
           MOVE ZERO TO WS-POS
           INSPECT WS-REMAIN TALLYING WS-POS FOR CHARACTERS BEFORE ' '
           IF WS-POS > 0
               MOVE WS-REMAIN(1:WS-POS) TO WS-TOKEN
               IF WS-POS < 499
                   MOVE WS-REMAIN(WS-POS + 2:) TO WS-REMAIN
                   MOVE FUNCTION TRIM(WS-REMAIN LEADING) TO WS-REMAIN
               ELSE
                   MOVE SPACES TO WS-REMAIN
               END-IF
           ELSE
               MOVE WS-REMAIN TO WS-TOKEN
               MOVE SPACES TO WS-REMAIN
           END-IF.

       2200-PARSE-TOKEN.
           MOVE ZERO TO WS-POS
           INSPECT WS-TOKEN TALLYING WS-POS FOR CHARACTERS BEFORE '='
           IF WS-POS > 0
               MOVE WS-TOKEN(1:WS-POS) TO WS-FIELD-NAME
               MOVE WS-TOKEN(WS-POS + 2:) TO WS-FIELD-VAL
               EVALUATE FUNCTION TRIM(WS-FIELD-NAME)
                   WHEN 'action'
                       MOVE FUNCTION UPPER-CASE(
                           FUNCTION TRIM(WS-FIELD-VAL)) TO WS-ACTION
                   WHEN 'account_id'
                       MOVE FUNCTION TRIM(WS-FIELD-VAL) TO WS-ACCOUNT-ID
                   WHEN 'balance'
                       MOVE FUNCTION NUMVAL(WS-FIELD-VAL) TO WS-BALANCE
                   WHEN 'rate'
                       MOVE FUNCTION NUMVAL(WS-FIELD-VAL) TO WS-RATE
                   WHEN 'days'
                       MOVE FUNCTION NUMVAL(WS-FIELD-VAL) TO WS-DAYS
                   WHEN OTHER
                       CONTINUE
               END-EVALUATE
           END-IF.

       3000-CALC-INTEREST.
           IF WS-RATE > ZEROS AND WS-DAYS > ZEROS
               DIVIDE 365 INTO WS-RATE GIVING WS-DAILY-RATE
               MULTIPLY WS-BALANCE   BY WS-DAILY-RATE GIVING WS-INTEREST
               MULTIPLY WS-DAYS      BY WS-INTEREST   GIVING WS-INTEREST
               MOVE WS-BALANCE TO WS-NEW-BALANCE
               ADD WS-INTEREST TO WS-NEW-BALANCE
           ELSE
               MOVE WS-BALANCE TO WS-NEW-BALANCE
               MOVE ZEROS TO WS-INTEREST
           END-IF
           ADD WS-INTEREST TO WS-TOTAL-INTEREST
           ADD WS-BALANCE  TO WS-TOTAL-BALANCE
           ADD 1 TO WS-TOTAL-ACCOUNTS
           MOVE WS-INTEREST    TO WS-INT-D
           MOVE WS-BALANCE     TO WS-BAL-D
           MOVE WS-NEW-BALANCE TO WS-NEWBAL-D
           IF WS-FIRST-REC = 'N'
               DISPLAY ','
           END-IF
           MOVE 'N' TO WS-FIRST-REC
           MOVE SPACES TO WS-OUT
           STRING
               '{"account_id":"' DELIMITED SIZE
               FUNCTION TRIM(WS-ACCOUNT-ID) DELIMITED SIZE
               '","balance":' DELIMITED SIZE
               FUNCTION TRIM(WS-BAL-D) DELIMITED SIZE
               ',"interest":' DELIMITED SIZE
               FUNCTION TRIM(WS-INT-D) DELIMITED SIZE
               ',"new_balance":' DELIMITED SIZE
               FUNCTION TRIM(WS-NEWBAL-D) DELIMITED SIZE
               '}' DELIMITED SIZE
               INTO WS-OUT
           END-STRING
           DISPLAY FUNCTION TRIM(WS-OUT).

       9000-SUMMARY.
           MOVE WS-TOTAL-INTEREST TO WS-TOTINT-D
           MOVE WS-TOTAL-BALANCE  TO WS-TOTBAL-D
           MOVE WS-TOTAL-ACCOUNTS TO WS-ACCT-D
           MOVE SPACES TO WS-OUT
           STRING
               '],"summary":{"accounts":' DELIMITED SIZE
               FUNCTION TRIM(WS-ACCT-D)
                   DELIMITED SIZE
               ',"total_interest":' DELIMITED SIZE
               FUNCTION TRIM(WS-TOTINT-D) DELIMITED SIZE
               ',"total_balance":' DELIMITED SIZE
               FUNCTION TRIM(WS-TOTBAL-D) DELIMITED SIZE
               '}}' DELIMITED SIZE
               INTO WS-OUT
           END-STRING
           DISPLAY FUNCTION TRIM(WS-OUT).
